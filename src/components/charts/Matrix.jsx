import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { reducedMotion } from '../../lib/motion.js'
import { fmt } from '../../lib/format.js'

/**
 * Which broken build each test mode catches. rows: { label, detail, budget, cells: [seed | null | 'n/a'] },
 * cols: { label, detail }. A seed is the lowest one that caught the bug; null means it survived
 * the budget, which is the cell the reader should notice; 'n/a' means the mode cannot run that code.
 */
export default function Matrix({ title, caption, cols, rows, budget }) {
  const box = useRef(null)
  useGSAP(
    () => {
      if (reducedMotion()) return
      gsap.from(box.current.querySelectorAll('tbody tr'), {
        opacity: 0,
        y: 10,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.07,
        scrollTrigger: { trigger: box.current, start: 'top 80%', once: true },
      })
    },
    { scope: box },
  )
  return (
    <figure className="viz" data-reveal>
      <figcaption className="viz__head">
        <span className="viz__title">{title}</span>
      </figcaption>
      <div className="matrix" ref={box} tabIndex={0} role="region" aria-label={`${title} (scrolls sideways)`}>
        <table>
          <thead>
            <tr>
              <th scope="col">rule switched off</th>
              {cols.map((c) => (
                <th key={c.label} scope="col">
                  {c.label}
                  <small>{c.detail}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">
                  {r.label}
                  <small>{r.detail}</small>
                </th>
                {r.cells.map((seed, i) =>
                  seed === 'n/a' ? (
                    <td key={i} className="matrix__na">
                      n/a
                    </td>
                  ) : seed ? (
                    <td key={i} className="matrix__caught">
                      seed {fmt(seed)}
                    </td>
                  ) : (
                    <td key={i} className="matrix__missed">
                      missed in {fmt(r.budget || budget)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="viz__caption">{caption}</p>
    </figure>
  )
}
