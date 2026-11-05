import { fmt } from '../../lib/format.js'

export default function StatTiles({ items, caption }) {
  return (
    <figure className="tiles-fig" data-reveal>
      <dl className="tiles">
        {items.map((t) => (
          <div key={t.label} className="tile">
            <dt>{t.label}</dt>
            <dd>
              <span className="tile__value">{fmt(t.value)}</span>
              <code className="tile__col">{t.column}</code>
            </dd>
          </div>
        ))}
      </dl>
      {caption && <figcaption className="viz__caption">{caption}</figcaption>}
    </figure>
  )
}
