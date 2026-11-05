import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { reducedMotion } from '../lib/motion.js'

function useSequence(scope, selector) {
  useGSAP(
    () => {
      if (reducedMotion()) return
      gsap.from(scope.current.querySelectorAll(selector), {
        opacity: 0,
        y: 14,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.18,
        scrollTrigger: { trigger: scope.current, start: 'top 78%', once: true },
      })
    },
    { scope },
  )
}

const VERSIONS = [
  { v: 'v1', status: 'queued', by: 'written by enqueue', fate: 'dead after the claim' },
  { v: 'v2', status: 'running', by: 'written by the claim', fate: 'dead after mark done' },
  { v: 'v3', status: 'done', by: 'written by mark done', fate: 'live until pruned', live: true },
]

export function RowVersions() {
  const scope = useRef(null)
  useSequence(scope, '.tuple, .tuple-arrow, .index-note')
  return (
    <figure className="diagram" ref={scope} data-reveal>
      <figcaption className="viz__head">
        <span className="viz__title">One job, three row versions</span>
      </figcaption>
      <ol className="tuples" aria-label="Row versions of one job, oldest first">
        {VERSIONS.map((t, i) => (
          <li key={t.v} className="tuples__step">
            {i > 0 && (
              <span className="tuple-arrow" aria-hidden="true">
                <span>update</span>
              </span>
            )}
            <div className={`tuple ${t.live ? 'tuple--live' : 'tuple--dead'}`}>
              <span className="tuple__v">{t.v}</span>
              <code>status = &apos;{t.status}&apos;</code>
              <span className="tuple__by">{t.by}</span>
              <span className="tuple__fate">{t.fate}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="index-note">
        <code>pglq_jobs_ready</code> (the partial index, <code>where status = &apos;queued&apos;</code>) still holds an entry for{' '}
        <strong>v1</strong> until vacuum removes it. Every claim that walks the head of the index visits it, checks the table,
        and finds a dead row.
      </p>
    </figure>
  )
}

const STEPS = [
  { t: 't0', c: 'Claim C starts and takes its snapshot. In it, row 42 is queued.', a: '' },
  { t: 't1', c: '', a: "Worker A's claim commits. Row 42 is now running, owned by A." },
  {
    t: 't2',
    c: (
      <>
        C reaches row 42. The row has a newer version than its snapshot, so C follows it, <strong>locks</strong> the
        newest version, then re-checks <code>status = &apos;queued&apos;</code>. False: the row is skipped, and the lock is kept.
      </>
    ),
    a: '',
    lock: true,
  },
  {
    t: 't3',
    c: 'C keeps scanning, slowly, past dead index entries.',
    a: (
      <>
        A's job is done. <code>update … set status = &apos;done&apos;</code> on row 42 <strong>waits</strong> for C:{' '}
        <code>Lock:transactionid</code>.
      </>
    ),
    wait: true,
  },
  { t: 't4', c: 'C commits. Its row locks are released.', a: "A's update goes through.", end: true },
]

export function StrayLock() {
  const scope = useRef(null)
  useSequence(scope, '.lane-row')
  return (
    <figure className="diagram" ref={scope} data-reveal>
      <figcaption className="viz__head">
        <span className="viz__title">A claim locks a row it does not take</span>
      </figcaption>
      <div className="lanes" role="table" aria-label="Timeline of claim C and worker A">
        <div className="lane-row lane-row--head" role="row">
          <span role="columnheader">time</span>
          <span role="columnheader">Claim C (another worker)</span>
          <span role="columnheader">Worker A (owns row 42)</span>
        </div>
        {STEPS.map((s) => (
          <div
            key={s.t}
            role="row"
            className={`lane-row${s.lock ? ' is-lock' : ''}${s.wait ? ' is-wait' : ''}${s.end ? ' is-end' : ''}`}
          >
            <span role="cell" className="lane-t">
              {s.t}
            </span>
            <span role="cell" className="lane-c" data-lane="Claim C">
              {s.c || <span className="lane-idle">·</span>}
            </span>
            <span role="cell" className="lane-a" data-lane="Worker A">
              {s.a || <span className="lane-idle">·</span>}
            </span>
          </div>
        ))}
      </div>
    </figure>
  )
}
