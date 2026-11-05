import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { reducedMotion } from './motion.js'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Fade-and-rise every [data-reveal] inside `scope` as it scrolls into view.
 * Nothing is hidden by CSS: the prerendered page is complete without JS, and elements are only
 * set to their start state here, below the fold, where the change cannot be seen.
 */
export function useReveal(scope, deps = []) {
  useGSAP(
    () => {
      if (reducedMotion()) return
      const items = gsap.utils.toArray('[data-reveal]', scope.current)
      for (const el of items) {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.92) continue // already on screen
        gsap.from(el, {
          opacity: 0,
          y: 28,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        })
      }
    },
    { scope, dependencies: deps, revertOnUpdate: true },
  )
}
