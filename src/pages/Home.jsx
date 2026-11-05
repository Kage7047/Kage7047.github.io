import { useRef } from 'react'
import SplitText from '../components/rb/SplitText.jsx'
import { POSTS } from '../routes.js'
import { useReveal } from '../lib/useReveal.js'
import { formatDate } from '../lib/format.js'

const PROJECTS = [
  {
    name: 'pg-lease-queue',
    href: 'https://github.com/Kage7047/pg-lease-queue',
    stack: 'Python · Postgres · asyncio',
    text: 'A crash-safe job queue on plain Postgres: SKIP LOCKED claims, leases with fencing tokens, and exactly-once effects, proven by a kill -9 chaos test that runs on every push against Postgres 14 to 17.',
  },
  {
    name: 'NudgeLink',
    href: 'https://nudgelink.co',
    stack: 'Python · FastAPI · Celery · Postgres · Stripe',
    note: 'private, in production',
    text: 'A multi-tenant AI SDR for LinkedIn outreach that I designed, built and run as CTO and sole engineer: durable multi-week agent workflows on Postgres and Celery, idempotent Stripe webhooks, envelope-encrypted credentials and per-call LLM cost metering.',
  },
  {
    name: 'kioku-assistant',
    href: 'https://github.com/Kage7047/kioku-assistant',
    stack: 'FastAPI · Celery · pgvector · Claude Agent SDK',
    text: 'A self-hosted agentic personal assistant over a git-backed markdown vault, with a default-deny approval gate on every outbound action and a written threat model. Hybrid retrieval measured on a labelled set (recall@5 0.97).',
  },
  {
    name: 'Sidequest',
    href: 'https://github.com/Kage7047/Sidequest',
    stack: 'Astro · Supabase · Postgres RLS',
    text: 'A full-stack shared planner where row-level security is the authorization boundary, sign-up is invite-only through an auth hook, and Web Push reminders run from an Edge Function on pg_cron.',
  },
  {
    name: 'edgefeed',
    href: 'https://github.com/Kage7047/edgefeed',
    stack: 'Python · SQLite · systemd',
    text: 'Detects cross-venue arbitrage on prediction markets (Kalshi and Polymarket), net of real fees and order-book depth. A validation spike: find out whether the edge exists before building the product.',
  },
]

export default function Home() {
  const scope = useRef(null)
  useReveal(scope)
  return (
    <div ref={scope}>
      <section className="wrap hero" aria-labelledby="hero-title">
        <p className="eyebrow">Warsaw · backend, full-stack and DevOps</p>
        <h1 id="hero-title" className="hero__title">
          <SplitText text="I build systems, then try to break them." tag="span" textAlign="left" splitType="words" delay={60} duration={1.1} />
        </h1>
        <p className="hero__lede">
          I&rsquo;m Ilya Nesterenok, CTO and sole engineer at <a href="https://nudgelink.co">NudgeLink</a>. I design, build and
          run it in production: CI, deploys, monitoring, backups and incident fixes. I&rsquo;m finishing a B.Eng. in
          Cybersecurity (2027), so security is part of how I build from the start.
        </p>
        <ul className="hero__links">
          <li>
            <a className="btn btn--primary" href="#writing">
              Read the writing
            </a>
          </li>
          <li>
            <a className="btn" href="https://github.com/Kage7047">
              GitHub
            </a>
          </li>
          <li>
            <a className="btn" href="mailto:ilya.nesterenok.work@gmail.com">
              Email
            </a>
          </li>
        </ul>
      </section>

      <section id="writing" className="wrap section" aria-labelledby="writing-title">
        <h2 id="writing-title" className="section__title" data-reveal>
          Writing
        </h2>
        <ul className="posts">
          {POSTS.map((p) => (
            <li key={p.slug} data-reveal>
              <a className="post-card" href={p.path}>
                <span className="post-card__meta">
                  <time dateTime={p.date}>{formatDate(p.date)}</time> · {p.tags.join(', ')}
                </span>
                <span className="post-card__title">{p.title}</span>
                <span className="post-card__dek">{p.dek}</span>
                <span className="post-card__more" aria-hidden="true">
                  Read →
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section id="projects" className="wrap section" aria-labelledby="projects-title">
        <h2 id="projects-title" className="section__title" data-reveal>
          Projects
        </h2>
        <ul className="projects">
          {PROJECTS.map((p) => (
            <li key={p.name} className="project" data-reveal>
              <h3 className="project__name">
                <a href={p.href}>{p.name}</a>
                {p.note && <span className="project__note">{p.note}</span>}
              </h3>
              <p className="project__stack">{p.stack}</p>
              <p className="project__text">{p.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
