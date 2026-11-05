export default function Tooltip({ tip }) {
  if (!tip) return null
  return (
    <div className="viz-tip" role="status" style={{ left: tip.x, top: tip.y }}>
      <strong>{tip.title}</strong>
      {tip.rows.map((r) => (
        <span key={r.label} className="viz-tip__row">
          {r.swatch && <i className="swatch" style={{ background: r.swatch }} aria-hidden="true" />}
          {r.label}
          <b>{r.value}</b>
        </span>
      ))}
    </div>
  )
}
