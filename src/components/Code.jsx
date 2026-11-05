import { useState } from 'react'

// A small highlighter for the two languages the posts use. Token classes are styled in styles.css.
const RULES = {
  sql: [
    ['comment', /--[^\n]*/y],
    ['string', /'(?:[^']|'')*'/y],
    ['number', /\b\d+(?:\.\d+)?\b/y],
    [
      'keyword',
      /\b(?:select|from|where|and|or|not|with|as|update|set|returning|order|by|limit|for|skip|locked|insert|into|values|alter|table|create|index|on|is|null|left|desc|any|coalesce|case|when|then|else|end)\b/iy,
    ],
    ['param', /%\([a-z_]+\)s|::[a-z_[\]]+/y],
  ],
  python: [
    ['comment', /#[^\n]*/y],
    ['string', /f?"(?:[^"\\]|\\.)*"|f?'(?:[^'\\]|\\.)*'/y],
    ['number', /\b\d+(?:\.\d+)?\b/y],
    ['keyword', /\b(?:if|else|elif|for|in|and|or|not|await|async|def|return|self|is|None|True|False)\b/y],
  ],
}

function tokenize(src, lang) {
  const rules = RULES[lang] || []
  const out = []
  let plain = ''
  for (let i = 0; i < src.length; ) {
    let hit = null
    if (/[\w%'"#:-]/.test(src[i]) && (i === 0 || !/\w/.test(src[i - 1]) || src[i] === ':')) {
      for (const [type, re] of rules) {
        re.lastIndex = i
        const m = re.exec(src)
        if (m && m[0]) {
          hit = [type, m[0]]
          break
        }
      }
    }
    if (hit) {
      if (plain) out.push(['', plain])
      plain = ''
      out.push(hit)
      i += hit[1].length
    } else {
      plain += src[i++]
    }
  }
  if (plain) out.push(['', plain])
  return out
}

export default function Code({ lang, caption, children }) {
  const src = String(children).replace(/^\n/, '').replace(/\s+$/, '')
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(src)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  }
  return (
    <figure className="code" data-reveal>
      <div className="code__bar">
        <span>{caption || lang}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${caption || lang} code`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0}>
        <code>
          {tokenize(src, lang).map(([type, text], i) =>
            type ? (
              <span key={i} className={`tk-${type}`}>
                {text}
              </span>
            ) : (
              text
            ),
          )}
        </code>
      </pre>
    </figure>
  )
}
