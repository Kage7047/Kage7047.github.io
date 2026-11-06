import Article from '../../components/Article.jsx'
import Code from '../../components/Code.jsx'
import BarList from '../../components/charts/BarList.jsx'
import Matrix from '../../components/charts/Matrix.jsx'

// Every number here comes from faultline's test output (README, PRs #1 to #3); the matrix is
// `go test ./sim -run TestControlMatrix -matrix -v` (lowest failing seed per mode).
const ELECTIONS = [
  { label: 'PreVote and CheckQuorum off', detail: '200 seeds', value: 2820 },
  { label: 'PreVote and CheckQuorum on', detail: 'same 200 seeds', value: 1354 },
]

const MODES = [
  { label: 'everything on', detail: 'PreVote, CheckQuorum, snapshots' },
  { label: 'classic', detail: 'snapshots only' },
  { label: 'bare', detail: 'none of them' },
]

const MATRIX = [
  { label: 'Vote for any candidate', detail: '§5.4.1', budget: 2000, cells: [1, 1, 1] },
  { label: 'Commit old-term entries', detail: 'Figure 8, one entry per message', budget: 2000, cells: [null, null, 1565] },
  { label: 'Install a stale snapshot', detail: 'older than the commit index', budget: 2000, cells: [1, 1, 'n/a'] },
  { label: 'No dedup of retried writes', detail: 'client sessions', budget: 200, cells: [1, 1, 1] },
  { label: 'Snapshot without the dedup table', detail: 'the 6.824 bug', budget: 200, cells: [30, 4, 'n/a'] },
  { label: 'Read without the quorum round', detail: 'ReadIndex rule 1', budget: 200, cells: [null, 1, 3] },
  { label: 'Read before the first commit of the term', detail: 'ReadIndex rule 2, one entry per message', budget: 200, cells: [11, 2, 39] },
]

const TOC = [
  { id: 'controls', title: 'A test that cannot fail tells you nothing' },
  { id: 'figure-8', title: '1,564 runs to see Figure 8' },
  { id: 'prevote', title: 'Fewer elections, fewer chances' },
  { id: 'readindex', title: 'A bug hidden by the code next to it' },
  { id: 'snapshots', title: 'Snapshots, again' },
  { id: 'matrix', title: 'The whole picture' },
  { id: 'real', title: 'Real processes, and my own test’s bug' },
  { id: 'keeping', title: 'What I am keeping' },
]

const REPO = 'https://github.com/Kage7047/faultline'

export default function FeaturesHideBugs({ route }) {
  return (
    <Article post={route.post} toc={TOC} readingMinutes={10}>
      <p>
        <a href={REPO}>faultline</a> is Raft consensus and a replicated key-value store in Go. I wrote the Raft node as a
        pure state machine: it does no I/O, starts no goroutines and never reads a clock. Something outside feeds it ticks
        and messages, and collects what it wants persisted, sent and applied. That one constraint makes it possible to run
        five nodes inside a single goroutine on a virtual clock, where one random seed decides every message delay, every
        lost or duplicated packet, every crash, restart and network split. Seed 1565 replays as seed 1565, on any machine,
        down to the message count.
      </p>
      <p>
        The simulated network is hostile on purpose. Messages take 1 to 30 ms and one in a hundred takes ten times longer,
        so it arrives after newer ones. 5% are lost and 2% delivered twice. A node crashes about every 1.7 seconds and the
        cluster splits in two about every 2.5. Each run lasts 30 virtual seconds, and a laptop gets through a hundred of them
        in a few seconds. After every step a checker tests the safety properties from Figure 3 of the{' '}
        <a href="https://raft.github.io/raft.pdf">Raft paper</a>, and every client history goes to{' '}
        <a href="https://github.com/anishathalye/porcupine">Porcupine</a>, which searches for a single-copy order that
        explains what every client saw.
      </p>
      <p>
        Thousands of runs pass. This post is about why that, by itself, meant much less than I thought, and about the
        pattern I kept running into: every feature I added to make the cluster better also made the tests worse at finding
        bugs.
      </p>

      <h2 id="controls">A test that cannot fail tells you nothing</h2>
      <p>
        Zero violations in a thousand runs has two explanations. The code is correct, or the test cannot see the kind of
        mistake the code might contain. From the outside the two look the same. So every safety rule in faultline has a
        switch that turns it off, and for every switch there is a test that requires the simulator to catch the broken
        build. I call those controls, as in a controlled experiment: the run that must come out positive.
      </p>
      <Code lang="go" caption="raft/types.go">{`
// Unsafe switches turn off one safety rule each. They exist so tests
// can prove the simulator catches the bugs these rules prevent.
type Unsafe struct {
    GrantAnyVote         bool // §5.4.1: vote for any candidate
    CommitOldTerms       bool // §5.4.2: the Figure 8 bug
    ReadWithoutQuorum    bool // answer reads without confirming leadership
    ReadBeforeTermCommit bool // answer reads before the new leader's no-op commits
    InstallStaleSnapshot bool // accept a snapshot older than the commit index
}
`}</Code>
      <p>
        A control reports the lowest seed that fails, not the first one a worker thread happened to finish, so the number is
        the same on a laptop and in CI. The first control, voting for any candidate whatever its log, fails on seed 1. That
        is the easy case. The interesting ones took work.
      </p>

      <h2 id="figure-8">1,564 runs to see Figure 8</h2>
      <p>
        Figure 8 of the Raft paper shows the protocol&rsquo;s most famous trap. A new leader finds an entry from an earlier
        term stored on a majority of nodes and marks it committed. It isn&rsquo;t: a node that never saw it can still win the
        next election and overwrite it. The rule is that a leader only counts replicas for entries of its own term, and older
        entries become committed indirectly, when one of its own entries after them commits.
      </p>
      <p>
        With that rule switched off, the simulator found nothing in 2,000 runs. The reason was in my own code. A new leader
        appends a no-op entry for its term, and when it catches a follower up it sends the old entries and the no-op in the
        same message. The old entry never reaches a majority on its own; the no-op always rides along, and the honest commit
        rule fires on it first. The bug needs a window that my message batching closed.
      </p>
      <p>
        Sending one entry per message reopens it. With that setting the broken build fails on seed 1,565: a leader of term
        64 is missing entry 148, which an earlier leader had committed. The same setting with the rule switched back on
        passes 200 seeds, so the failure is the bug and not the setting.
      </p>

      <h2 id="prevote">Fewer elections, fewer chances</h2>
      <p>
        Plain Raft has an annoying failure mode. A node cut off from the others keeps timing out and starting elections it
        cannot win, and each one raises its term. When the network heals, its high term forces the healthy leader to step
        down, and the cluster holds an election nobody needed. In a unit test that cuts one node off for 200 ticks, the leader
        is dragged from term 1 to term 14. Two features from Diego Ongaro&rsquo;s thesis fix it. With PreVote, a node asks
        whether it could win before it raises its term. With CheckQuorum, nodes ignore vote requests while they still hear
        from a leader, and a leader that cannot reach a majority steps down. With both, that leader stays at term 1.
      </p>

      <BarList
        title="Elections in the same 200 hostile runs"
        caption="Same seeds, same faults. The sum of final terms drops from 16,413 to 1,754."
        rows={ELECTIONS}
        unit="elections"
      />

      <p>
        Half the elections is what you want in production. It is also half the chances for an election bug to show itself.
        With PreVote and CheckQuorum on, the Figure 8 control, even with one entry per message, survived all 2,000 seeds. So
        did a stale-read control: a leader that answers reads from its own state without checking it is still the leader. A
        leader cut off from the majority believes it leads until CheckQuorum makes it step down, and that window shrank so far
        that 200 runs never hit it.
      </p>
      <p>
        Neither bug went away. Turning the features on only made the conditions they need rare, and rare is the worst kind of
        bug: it passes CI and shows up later in production. So every safety test now runs twice, with the features on and
        with them off, and each control runs in the mode where its window is open.
      </p>

      <h2 id="readindex">A bug hidden by the code next to it</h2>
      <p>
        Reads used to go through the log like writes, which is correct and slow: every read costs a replicated entry and an
        fsync on a majority. ReadIndex skips that. The leader notes its commit index, then confirms with one round of
        heartbeats that a majority still follows it. If they do, no newer leader can exist, and the read is served as soon
        as the local state has caught up to that index. In the simulator it cut log entries per client operation from 1.06 to
        0.64, with every history still linearizable.
      </p>
      <p>
        ReadIndex has two rules, so it got two controls. Skipping the heartbeat round is the stale-read bug from the last
        section, and as before it is caught on seed 1 once PreVote and CheckQuorum are off. The second rule is subtler: a brand-new leader may not answer reads until it has committed an entry of its own term,
        because until then its commit index can lag behind writes the old leader already confirmed to clients. Break that
        rule, and the stale read should be easy to find.
      </p>
      <p>
        It survived 200 seeds in every mode. The heartbeat round that confirms the read carries the new leader&rsquo;s no-op
        too, since every heartbeat is an append message. The same responses that confirm leadership also commit the no-op,
        the commit index catches up in the same step, and the read comes out fresh. The code next to the bug was covering for
        it. One entry per message again lets a lagging follower confirm the read before it has the no-op, and the stale read
        appears.
      </p>

      <h2 id="snapshots">Snapshots, again</h2>
      <p>
        Without compaction the log grows forever. With it, each node snapshots its state every 50 applied entries and drops
        the entries before, and a follower that needs an entry the leader no longer has gets the leader&rsquo;s snapshot
        instead. Two new controls caught what they should: a follower that installs a delayed snapshot older than its commit
        index (it rolls back from index 88 to 50 on seed 1), and a store whose snapshot leaves out the table of applied
        request IDs, so a restored replica applies a retried write a second time. That second one is a classic bug in
        MIT&rsquo;s 6.824 labs, and it took until seed 30.
      </p>
      <p>
        Then the Figure 8 control stopped failing again. Snapshots turned out to hide it in the same way PreVote had: a
        follower that falls behind now catches up with one snapshot instead of entry by entry, and entry by entry was the
        window the bug needed. So there is a third mode, with snapshots off as well.
      </p>

      <h2 id="matrix">The whole picture</h2>
      <p>
        Every control, run in all three modes. Each cell is the lowest seed that caught the broken build, or the number of
        runs it survived.
      </p>

      <Matrix
        title="Which test mode catches which broken build"
        caption="Lowest failing seed per mode. Consensus controls get 2,000 runs, key-value controls 200. “n/a”: with snapshots off the snapshot code never runs. Scroll sideways on a phone."
        cols={MODES}
        rows={MATRIX}
        budget={2000}
      />

      <p>
        No column is clean. The mode I would deploy, with everything on, misses two of the seven broken builds. Classic
        misses Figure 8. Bare catches everything it can run, but it never takes a snapshot, so the two snapshot bugs are
        invisible to it. Only the three modes together catch all seven, which is why every safety test now runs three
        times. It costs about three times the CPU, and in CI that is a couple of minutes.
      </p>
      <p>
        The seeds vary too. The missing dedup table takes until seed 30 with everything on and is caught on seed 4 in
        classic mode, where more elections mean more retries landing on a freshly restored node. A low seed doesn&rsquo;t
        mean a bug is easy to hit in production. It means the test configuration happens to open its window often.
      </p>

      <h2 id="real">Real processes, and my own test&rsquo;s bug</h2>
      <p>
        The simulator tests the algorithm. It does not test the server around it: the write-ahead log, fsync, the HTTP
        transport, the client retries. For that there is a chaos test that builds the real binary and starts three
        processes on localhost with five clients on them. For a minute it either <code>kill -9</code>s a node and restarts
        it, or freezes the leader with <code>SIGSTOP</code> and wakes it with <code>SIGCONT</code> a second later, still
        convinced it leads. Then it waits for every replica to hold the same state and checks the history with the same
        Porcupine model the simulator uses. One run: 8,979 operations, 15 kills, 13 freezes, no violations.
      </p>
      <p>
        It got a control too: a build that answers reads without the heartbeat round, attacked by freezing the leader over
        and over. The frozen leader wakes up with old data and nobody has told it about the new term yet. It should serve a
        stale read almost at once.
      </p>
      <p>
        The broken build passed. This time the bug was in the test. Every client waited up to two seconds per attempt, longer
        than any freeze. So while the leader was frozen, all five clients were stuck waiting on it, nobody wrote anything
        through the new leader, and when the old one woke up there was nothing stale to read. The fix was to make the clients
        look like real ones, which never all have the same timeout. Three now give up after 250 ms and move to the new leader
        and write. Two wait five seconds on the old one, then send it their next read the moment it wakes. With that mix the
        broken build failed in all five runs, and the correct one still passes.
      </p>
      <p>
        One limit, so the numbers aren&rsquo;t read as more than they are. <code>kill -9</code> kills the process, not the
        machine. What the process wrote is still in the operating system&rsquo;s page cache and survives without any fsync, so
        the chaos test says nothing about power loss. The log covers that separately: its tests cut the file at every byte
        offset of the last write, flip bits in it, and require every version to reopen to a consistent state.
      </p>

      <h2 id="keeping">What I am keeping</h2>
      <ul>
        <li>
          <strong>Every passing test needs a broken build that fails it.</strong> Four of my controls passed when I first wrote
          them. Each time the test was blind, not the code correct.
        </li>
        <li>
          <strong>Features that make a system stable make bugs rare, not gone.</strong> PreVote, CheckQuorum and snapshots
          each shrank a window some bug needed. Test with them off as well as on.
        </li>
        <li>
          <strong>Look at what runs next to the rule.</strong> Batching hid Figure 8 and heartbeats hid the read bug. When a
          control passes, the reason is usually a neighbour doing the rule&rsquo;s job by accident.
        </li>
        <li>
          <strong>A chaos test is only as varied as its clients.</strong> Identical clients move in lockstep, and lockstep
          hides exactly the interleavings that break things.
        </li>
      </ul>
      <p>
        The code, the simulator and the chaos test are at <a href={REPO}>github.com/Kage7047/faultline</a>. To replay the
        Figure 8 failure, or start a cluster you can <code>kill -9</code> by hand:
      </p>
      <Code lang="shell" caption="shell">{`
go test ./sim -run TestControlCommitOldTermsIsCaught -v
go test ./chaos -chaos -v
scripts/cluster.sh up && scripts/cluster.sh status
`}</Code>
    </Article>
  )
}
