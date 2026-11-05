import Article from '../../components/Article.jsx'
import Code from '../../components/Code.jsx'
import ColumnChart from '../../components/charts/ColumnChart.jsx'
import BarList from '../../components/charts/BarList.jsx'
import StatTiles from '../../components/charts/StatTiles.jsx'
import { RowVersions, StrayLock } from '../../components/Diagrams.jsx'

// Every number here comes from pg-lease-queue's docs/adr/0004 and docs/BENCHMARKS.md.
const RUNS = [
  { x: 1, xLabel: '1 worker process', before: 922, after: 1428 },
  { x: 2, xLabel: '2 worker processes', before: 1378, after: 2144 },
  { x: 4, xLabel: '4 worker processes', before: 1638, after: 2747 },
  { x: 8, xLabel: '8 worker processes', before: 306, after: 2152 },
]
const BEFORE = [{ key: 'before', label: 'First version', color: '--series-2' }]
const BOTH = [
  { key: 'before', label: 'Before', color: '--series-2' },
  { key: 'after', label: 'After', color: '--series-1' },
]

const TOC = [
  { id: 'measure', title: 'Measure before guessing' },
  { id: 'dead-tuples', title: '1. A queue table is a dead-tuple factory' },
  { id: 'one-claim-per-job', title: '2. One claim per job' },
  { id: 'stray-locks', title: '3. The lock that was not mine' },
  { id: 'one-commit-per-job', title: '4. One commit per job' },
  { id: 'after', title: 'After' },
  { id: 'keeping', title: 'What I am keeping' },
]

const REPO = 'https://github.com/Kage7047/pg-lease-queue'

export default function MoreWorkersSlower({ route }) {
  return (
    <Article post={route.post} toc={TOC} readingMinutes={9}>
      <p>
        <a href={REPO}>pg-lease-queue</a> is a job queue I wrote on plain Postgres. Workers claim jobs with{' '}
        <code>FOR UPDATE SKIP LOCKED</code>, hold them on a lease they keep renewing, and can only finish a job while they
        hold its current lease token. Before calling it done I wrote a benchmark: start <em>N</em> worker processes, insert
        20,000 no-op jobs in one transaction, and time how long it takes until the last one is done. No-op jobs measure the
        queue&rsquo;s own overhead and nothing else.
      </p>
      <p>The first run looked healthy up to four workers. Then it didn&rsquo;t.</p>

      <ColumnChart
        title="Throughput of the first version"
        caption="20,000 no-op jobs, 16 in flight per worker process, Postgres 16 on the same 2-core laptop. One run per setting."
        data={RUNS}
        series={BEFORE}
        xTitle="worker processes"
        yTitle="jobs per second"
        yMax={2000}
        yStep={500}
        label={() => true}
      />

      <p>
        Going from four workers to eight cut throughput by a factor of five. A flat line would have meant a bottleneck: some
        shared resource running at its limit. A line that falls means the workers were actively making each other slower.
      </p>

      <h2 id="measure">Measure before guessing</h2>
      <p>
        The obvious suspect is contention on the head of the queue, every worker fighting over the same few rows. But that is
        exactly what <code>SKIP LOCKED</code> exists to prevent: a claimer that meets a locked row skips it instead of waiting.
        So instead of guessing, I asked Postgres what its connections were doing. <code>pg_stat_activity</code> shows, for
        every connection, the statement it is running and what it is waiting for, if anything. A query along these lines, run
        every half second during the 8-worker run:
      </p>
      <Code lang="sql" caption="sampling pg_stat_activity">{`
select coalesce(wait_event_type || ':' || wait_event, 'running')
         as doing,
       left(query, 60) as statement
from pg_stat_activity
where backend_type = 'client backend'
  and state = 'active'
  and pid <> pg_backend_pid();
`}</Code>
      <p>
        An active connection with no wait event is executing, which is as close to &ldquo;on CPU&rdquo; as this view gets.
        Fifteen snapshots, grouped by statement and wait:
      </p>

      <BarList
        title="What busy connections were doing during the 8-worker run"
        caption="Connections seen in each state, summed over 15 snapshots taken 0.5 s apart."
        unit="sightings"
        rows={[
          { label: 'Claim query', detail: 'running', value: 71 },
          { label: 'Mark done', detail: 'waiting on a row lock (Lock:transactionid)', value: 35 },
          { label: 'Mark done', detail: 'waiting on the WAL (LWLock:WALWrite, IO:WALSync)', value: 33 },
        ]}
      />

      <p>
        Three things stand out. Claims, which should take well under a millisecond, were what the database was most often busy
        running. Completions, a single-row update by primary key, were stuck waiting for some other transaction&rsquo;s lock.
        And when they weren&rsquo;t, they were waiting for the write-ahead log to reach the disk. Each of these turned out to
        have its own cause, and they made each other worse.
      </p>

      <h2 id="dead-tuples">1. A queue table is a dead-tuple factory</h2>
      <p>
        The table statistics in <code>pg_stat_user_tables</code> explained the slow claims:
      </p>
      <StatTiles
        items={[
          { label: 'Dead row versions', value: 91185, column: 'n_dead_tup' },
          { label: 'Live rows (estimate)', value: 0, column: 'n_live_tup' },
          { label: 'HOT updates', value: 0, column: 'n_tup_hot_upd' },
        ]}
        caption="pg_stat_user_tables for pglq_jobs during the 8-worker benchmark."
      />
      <p>
        The live count of zero is an estimate that only vacuum and analyze refresh, so the zero says on its own that
        autovacuum had not processed the table during the runs. The dead count says what it would have found.
      </p>
      <p>
        Postgres never changes a row in place. An update writes a new version of the row and marks the old one dead, and
        vacuum reclaims dead versions later. A job lives through three versions:
      </p>

      <RowVersions />

      <p>
        Postgres has an optimisation for frequent updates, the heap-only tuple (HOT) update, which skips writing new index
        entries when no indexed column changes. It can&rsquo;t apply here. Every transition changes <code>status</code>, and{' '}
        <code>status</code> decides whether the row belongs in the partial index the claim reads. So every claim and every
        completion also leaves index entries behind for rows that are no longer ready. The claim walks that index in order,
        which means stepping over every stale entry at the head of the queue, checking the table to learn each one is dead,
        before it reaches a row it can take.
      </p>
      <p>
        Autovacuum&rsquo;s default trigger is 20% of the table plus 50 rows. That is sensible for a table of customers. For a
        table that rewrites itself three times per job, it means vacuum arrives long after the head of the index has filled
        with dead entries. The fix is per-table storage settings, so nothing else in the database changes (the migration
        sets the same values when it creates the table):
      </p>
      <Code lang="sql" caption="per-table autovacuum for the queue">{`
alter table pglq_jobs set (
    -- vacuum after 1% churn instead of 20%
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_insert_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.05,
    -- and let it work faster when it runs
    autovacuum_vacuum_cost_delay = 1
);
`}</Code>
      <p>
        Pruning finished jobs on a schedule (<code>pglq prune --older-than 7d</code>) keeps the table, and every scan of it,
        small.
      </p>

      <h2 id="one-claim-per-job">2. One claim per job</h2>
      <p>
        Each worker kept 16 jobs in flight. Whenever one finished, a slot opened, and the worker claimed again: for one job.
        With no-op jobs that is one claim per job, 20,000 locking index scans that each wade through the dead entries above
        and each return a single row. A claim costs about the same whether it returns one row or sixteen, so the fix is to
        take more per trip. A worker now claims only when at least a quarter of its slots are free, or when it is idle, and
        then fills all of them at once:
      </p>
      <Code lang="python" caption="worker loop">{`
free = self.concurrency - len(self._inflight)
if free >= self.claim_batch or (free > 0 and not self._inflight):
    jobs = await self._claim(free)  # one round trip, up to \`free\` rows
`}</Code>
      <p>
        The trade-off is written down in the decision record: a worker with fewer than <code>claim_batch</code> free slots
        waits for more to finish before it takes new work. For long jobs where pickup latency matters more than overhead, set{' '}
        <code>claim_batch</code> to 1.
      </p>

      <h2 id="stray-locks">3. The lock that was not mine</h2>
      <p>
        The row-lock waits were stranger. A completion updates one row, by primary key, that the same worker claimed a moment
        ago. Nobody else has any business touching it. Yet the samples kept catching completions in{' '}
        <code>Lock:transactionid</code>, waiting for another transaction to end.
      </p>
      <p>
        The explanation that fits is a detail of how <code>FOR UPDATE</code> behaves under <code>READ COMMITTED</code>,
        Postgres&rsquo;s default isolation level. A claim scans with the snapshot it started with. When it reaches a row that
        another transaction changed and committed after that snapshot, for example a row another worker has just claimed, it
        does not simply skip it. It follows the row to its newest version, locks that version, and only then re-checks the{' '}
        <code>WHERE</code> clause. The re-check fails, because the newest version is <code>running</code> and not{' '}
        <code>queued</code>, so the row is not returned. But the lock has been taken, and row locks in Postgres last until the
        transaction ends.
      </p>

      <StrayLock />

      <p>
        So the worker that owns the job goes to mark it done, finds its own row locked by someone else&rsquo;s claim, and waits
        for that claim to commit. With fast claims the wait is too short to notice. With claims slowed down by dead index
        entries (1) and repeated 20,000 times (2), it becomes a queue of its own. <code>SKIP LOCKED</code> skips rows that are
        already locked when the scan reaches them. It says nothing about the locks the scan takes itself.
      </p>
      <p>
        I did not fix this one head on. Making claims short and rare shrinks the window until the waits stop mattering, which is
        why the three causes have to be read together.
      </p>

      <h2 id="one-commit-per-job">4. One commit per job</h2>
      <p>
        The last third of the samples were completions waiting on <code>WALWrite</code> and <code>WALSync</code>. Each
        completion was its own transaction, and with <code>synchronous_commit = on</code> (the default, and what you want for a
        queue that promises not to lose work) each commit waits until its WAL record is flushed to disk. Postgres already
        groups concurrent commits into one flush when it can, but thousands of separate commits a second still meant a lot of
        flushes on a laptop SSD.
      </p>
      <p>
        Batching completions sounds as if it must add latency: wait ten milliseconds, collect, write. It doesn&rsquo;t have
        to. The completer writes a completion at once if nothing is being written. Completions that arrive while a write is in
        flight wait for it to finish, then go out together as one statement and one commit:
      </p>
      <Code lang="sql" caption="mark a batch done, each row fenced by its own token">{`
update pglq_jobs j
set status = 'done', result = v.result, finished_at = now(),
    lease_token = null, lease_until = null
from unnest(%(ids)s::bigint[],
            %(tokens)s::uuid[],
            %(results)s::jsonb[]) as v(id, token, result)
where j.id = v.id
  and j.lease_token = v.token
  and j.status = 'running'
returning j.id
`}</Code>
      <p>
        Every row is still checked against its own lease token, so a batch can never finish a job that someone else holds now.
        The <code>kill -9</code> chaos test, which kills workers at random while they drain 3,000 jobs and then counts effects,
        runs against this code on every push. Under light load every batch holds a single job and nothing waits that would not
        have waited anyway. Under load, batches grow by themselves, which is exactly when commits are the bottleneck.
      </p>

      <h2 id="after">After</h2>
      <ColumnChart
        title="Throughput before and after the changes"
        caption="Same machine and workload. Before: one run per setting. After: median of three runs."
        data={RUNS}
        series={BOTH}
        xTitle="worker processes"
        yTitle="jobs per second"
        yMax={3000}
        yStep={1000}
        label={(row) => row.x === 4 || row.x === 8}
      />
      <p>
        Eight workers went from 306 to 2,152 jobs a second, and four from 1,638 to 2,747. The full runs, including the spread
        between them, are in <a href={`${REPO}/blob/main/docs/BENCHMARKS.md`}>BENCHMARKS.md</a>.
      </p>
      <p>
        Eight is still slower than four, but for a duller reason: eight Python processes and their eight Postgres backends
        share two physical cores. On a database server with cores of its own I would expect the line to keep rising. I
        haven&rsquo;t measured that, so treat it as a guess.
      </p>

      <h2 id="keeping">What I am keeping</h2>
      <ul>
        <li>
          <strong>Sample wait events before forming a theory.</strong> Fifteen snapshots of <code>pg_stat_activity</code>{' '}
          pointed at three separate causes. Any single guess would have found one at most.
        </li>
        <li>
          <strong>A queue table is churn.</strong> Tune autovacuum per table, prune finished rows, and remember that HOT
          updates can&rsquo;t help when the column you change is the one your index filters on.
        </li>
        <li>
          <strong>
            <code>SKIP LOCKED</code> is not lock-free.
          </strong>{' '}
          Under <code>READ COMMITTED</code>, a locking scan can lock rows it then skips, and someone else waits for it.
        </li>
        <li>
          <strong>Batch the expensive round trips, but only when there is a queue to batch.</strong> Writing at once when idle
          and batching while busy gives you the throughput under load without the latency when it is quiet.
        </li>
      </ul>
      <p>
        The code is at <a href={REPO}>github.com/Kage7047/pg-lease-queue</a>, and the decision record for these changes is{' '}
        <a href={`${REPO}/blob/main/docs/adr/0004-batching-claims-and-completions.md`}>ADR 0004</a>. To run the benchmark on
        your own machine:
      </p>
      <Code lang="shell" caption="shell">{`
pglq bench --jobs 20000 --workers 1,2,4,8 --concurrency 16
`}</Code>
    </Article>
  )
}
