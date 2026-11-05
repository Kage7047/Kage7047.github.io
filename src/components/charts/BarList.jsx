import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { reducedMotion } from '../../lib/motion.js'
import { fmt } from '../../lib/format.js'
import Tooltip from './Tooltip.jsx'

/** Horizontal bars, one series, labelled rows. Rows carry { label, detail, value }. */
export default function BarList({ title, caption, rows, unit, max }) {
  const box = useRef(null)
  const [tip, setTip] = useState(null)
  const top = max || Math.max(...rows.map((r) => r.value))

  useGSAP(
    () => {
      if (reducedMotion()) return
      gsap.from(box.current.querySelectorAll('.bar__fill'), {
        scaleX: 0,
        transformOrigin: '0 50%',
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: { trigger: box.current, start: 'top 80%', once: true },
      })
    },
    { scope: box },
  )

  const show = (r, el) => {
    const host = box.current.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    setTip({
      x: Math.min(b.left - host.left + (b.width * r.value) / top, host.width - 110),
      y: b.top - host.top - 4,
      title: r.label,
      rows: [{ label: r.detail, value: `${fmt(r.value)} ${unit}` }],
    })
  }

  return (
    <figure className="viz" data-reveal>
      <figcaption className="viz__head">
        <span className="viz__title">{title}</span>
      </figcaption>
      <div className="viz__plot bars" ref={box} onMouseLeave={() => setTip(null)}>
        {rows.map((r) => (
          <div
            key={r.label}
            className="bar"
            tabIndex={0}
            aria-label={`${r.label}, ${r.detail}: ${fmt(r.value)} ${unit}`}
            onMouseEnter={(e) => show(r, e.currentTarget.querySelector('.bar__track'))}
            onFocus={(e) => show(r, e.currentTarget.querySelector('.bar__track'))}
            onBlur={() => setTip(null)}
          >
            <span className="bar__label">
              {r.label}
              <small>{r.detail}</small>
            </span>
            <span className="bar__track">
              <span className="bar__fill" style={{ width: `${(r.value / top) * 100}%` }} />
              <span className="bar__value" style={{ left: `${(r.value / top) * 100}%` }}>
                {fmt(r.value)}
              </span>
            </span>
          </div>
        ))}
        <Tooltip tip={tip} />
      </div>
      <p className="viz__caption">{caption}</p>
    </figure>
  )
}
