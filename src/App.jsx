import { useEffect } from 'react'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import MoreWorkersSlower from './pages/posts/MoreWorkersSlower.jsx'
import FeaturesHideBugs from './pages/posts/FeaturesHideBugs.jsx'
import KyvernoFailsOpen from './pages/posts/KyvernoFailsOpen.jsx'
import { useReducedMotionState } from './lib/motion.js'
import { startSmoothScroll, stopSmoothScroll } from './lib/smooth.js'

const PAGES = { home: Home, 404: NotFound, 'more-workers-slower': MoreWorkersSlower, 'features-hide-bugs': FeaturesHideBugs, 'kyverno-fails-open': KyvernoFailsOpen }

export default function App({ route }) {
  const reduced = useReducedMotionState()
  useEffect(() => {
    if (reduced) return stopSmoothScroll()
    startSmoothScroll()
    return stopSmoothScroll
  }, [reduced])
  const Page = PAGES[route.page]
  return (
    <Layout route={route}>
      <Page route={route} />
    </Layout>
  )
}
