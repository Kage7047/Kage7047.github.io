import { SITE } from '../routes.js'
import { setMotion, useReducedMotionState } from '../lib/motion.js'
import { setTheme, useTheme } from '../lib/theme.js'

const LINKS = {
  github: 'https://github.com/Kage7047',
  linkedin: 'https://www.linkedin.com/in/nesterenokilya',
  email: 'mailto:ilya.nesterenok.work@gmail.com',
}

export default function Layout({ route, children }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap site-header__in">
          <a className="brand" href="/" aria-current={route.page === 'home' ? 'page' : undefined}>
            <span className="brand__mark" aria-hidden="true">
              IN
            </span>
            {SITE.name}
          </a>
          <nav aria-label="Main">
            <ul className="nav">
              <li>
                <a href="/#writing">Writing</a>
              </li>
              <li>
                <a href="/#projects">Projects</a>
              </li>
              <li>
                <a href={LINKS.github}>GitHub</a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  )
}

function Footer() {
  const reduced = useReducedMotionState()
  const theme = useTheme()
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__in">
        <p>
          © 2026 {SITE.name} · <a href={LINKS.email}>Email</a> · <a href={LINKS.github}>GitHub</a> ·{' '}
          <a href={LINKS.linkedin}>LinkedIn</a> · <a href="/feed.xml">RSS</a>
        </p>
        <div className="prefs">
          <label>
            Theme{' '}
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <button type="button" className="chip" aria-pressed={!reduced} onClick={() => setMotion(reduced)}>
            Motion {reduced ? 'off' : 'on'}
          </button>
        </div>
      </div>
    </footer>
  )
}
