import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { reducedMotion } from '../../lib/motion.js'
import { fmt } from '../../lib/format.js'
import { useWidth } from './useWidth.js'
import Tooltip from './Tooltip.jsx'

/**
 * Grouped columns: one group per x value, one column per series.
 * series: [{ key, label, color (css var) }]; data: [{ x, xLabel, [key]: number }]
 * label(row, series) -> true to print the value on that column's cap (selective direct labels).
 */
export default function ColumnChart({ title, caption, data, series, xTitle, yTitle, yMax, yStep, label, tableCaption }) {
  const box = useRef(null)
  const width = useWidth(box)
  const [tip, setTip] = useState(null)
  const height = 300
  const m = { top: 28, right: 8, bottom: 44, left: 56 }
  const iw = width - m.left - m.right
  const ih = height - m.top - m.bottom
  const y = (v) => m.top + ih - (v / yMax) * ih
  const band = iw / data.length
  const gap = 2
  const colW = Math.max(10, Math.min(46, (band * 0.62 - gap * (series.length - 1)) / series.length))
  const groupW = colW * series.length + gap * (series.length - 1)
  const ticks = []
  for (let v = 0; v <= yMax; v += yStep) ticks.push(v)

  useGSAP(
    () => {
      if (reducedMotion()) return
      gsap.from(box.current.querySelectorAll('.col'), {
        scaleY: 0,
        transformOrigin: '50% 100%',
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.06,
        scrollTrigger: { trigger: box.current, start: 'top 80%', once: true },
      })
    },
    { scope: box },
  )

  const show = (row, i) => {
    const cx = m.left + band * i + band / 2
    setTip({
      x: Math.min(Math.max(cx, 90), width - 90),
      y: y(Math.max(...series.map((s) => row[s.key]))) - 12,
      title: row.xLabel,
      rows: series.map((s) => ({ label: s.label, value: `${fmt(row[s.key])} jobs/s`, swatch: `var(${s.color})` })),
    })
  }

  return (
    <figure className="viz" data-reveal>
      <figcaption className="viz__head">
        <span className="viz__title">{title}</span>
        {series.length > 1 && (
          <span className="legend">
            {series.map((s) => (
              <span key={s.key} className="legend__item">
                <i className="swatch" style={{ background: `var(${s.color})` }} aria-hidden="true" />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="viz__plot" ref={box} onMouseLeave={() => setTip(null)}>
        <svg width={width} height={height} role="img" aria-label={`${title}. ${caption}`}>
          <text className="axis-title" x={m.left} y={12}>
            {yTitle}
          </text>
          {ticks.map((v) => (
            <g key={v}>
              <line className={v === 0 ? 'baseline' : 'grid'} x1={m.left} x2={width - m.right} y1={y(v)} y2={y(v)} />
              <text className="tick" x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
                {fmt(v)}
              </text>
            </g>
          ))}
          {data.map((row, i) => {
            const x0 = m.left + band * i + (band - groupW) / 2
            return (
              <g
                key={row.x}
                className="col-group"
                tabIndex={0}
                aria-label={`${row.xLabel}: ${series.map((s) => `${s.label} ${fmt(row[s.key])} jobs per second`).join(', ')}`}
                onMouseEnter={() => show(row, i)}
                onFocus={() => show(row, i)}
                onBlur={() => setTip(null)}
              >
                <rect className="hit" x={m.left + band * i} y={m.top} width={band} height={ih} />
                {series.map((s, j) => {
                  const v = row[s.key]
                  const x = x0 + j * (colW + gap)
                  const top = y(v)
                  const r = Math.min(4, colW / 2, y(0) - top)
                  return (
                    <g key={s.key}>
                      <path
                        className="col"
                        style={{ fill: `var(${s.color})` }}
                        d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + colW - r} Q${x + colW},${top} ${x + colW},${top + r} V${y(0)} Z`}
                      />
                      {label?.(row, s) && (
                        <text className="cap" x={x + colW / 2} y={top - 6} textAnchor="middle">
                          {fmt(v)}
                        </text>
                      )}
                    </g>
                  )
                })}
                <text className="tick" x={m.left + band * i + band / 2} y={height - m.bottom + 18} textAnchor="middle">
                  {row.x}
                </text>
              </g>
            )
          })}
          <text className="axis-title" x={m.left + iw / 2} y={height - 6} textAnchor="middle">
            {xTitle}
          </text>
        </svg>
        <Tooltip tip={tip} />
      </div>
      <p className="viz__caption">{caption}</p>
      <details className="viz__table">
        <summary>Show the numbers as a table</summary>
        <table>
          <caption className="sr-only">{tableCaption || title}</caption>
          <thead>
            <tr>
              <th scope="col">{xTitle}</th>
              {series.map((s) => (
                <th key={s.key} scope="col" className="num">
                  {s.label} (jobs/s)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.x}>
                <th scope="row">{row.x}</th>
                {series.map((s) => (
                  <td key={s.key} className="num">
                    {fmt(row[s.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
