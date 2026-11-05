import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitText from './rb/SplitText.jsx'
import { useReveal } from '../lib/useReveal.js'
import { formatDate } from '../lib/format.js'
import { scrollToTarget } from '../lib/smooth.js'

gsap.registerPlugin(ScrollTrigger)

export default function Article({ post, toc, readingMinutes, children }) {
  const scope = useRef(null)
  const bar = useRef(null)
  const [active, setActive] = useState(toc[0]?.id)
  useReveal(scope)

  // reading progress: a transform on one element, driven by ScrollTrigger (works with and without Lenis)
  useGSAP(
    () => {
      const st = ScrollTrigger.create({
        trigger: scope.current.querySelector('.prose'),
        start: 'top 30%',
        end: 'bottom 70%',
        onUpdate: (self) => gsap.set(bar.current, { scaleX: self.progress }),
      })
      return () => st.kill()
    },
    { scope },
  )

  // the current section is the last heading above the top fifth of the screen (the first one before any)
  useEffect(() => {
    const heads = toc.map((t) => document.getElementById(t.id)).filter(Boolean)
    let raf = 0
    const update = () => {
      raf = 0
      const line = window.innerHeight * 0.2
      let current = toc[0]?.id
      for (const h of heads) if (h.getBoundingClientRect().top <= line) current = h.id
      setActive(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [toc])

  const jump = (e, id) => {
    e.preventDefault()
    scrollToTarget(`#${id}`, -24)
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <article className="article" ref={scope}>
      <div className="progress" aria-hidden="true">
        <span ref={bar} />
      </div>
      <header className="wrap article__head">
        <p className="eyebrow">
          <a href="/#writing">Writing</a> · {post.tags.join(', ')}
        </p>
        <h1 className="article__title">
          <SplitText text={post.title} tag="span" textAlign="left" splitType="words" delay={45} duration={1} />
        </h1>
        <p className="article__dek">{post.dek}</p>
        <p className="article__meta">
          <time dateTime={post.date}>{formatDate(post.date)}</time> · {readingMinutes} min read · Ilya Nesterenok
        </p>
      </header>
      <div className="wrap article__grid">
        <nav className="toc" aria-label="On this page">
          <p className="toc__title">On this page</p>
          <ol>
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} aria-current={active === t.id ? 'true' : undefined} onClick={(e) => jump(e, t.id)}>
                  {t.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="prose">{children}</div>
      </div>
    </article>
  )
}
