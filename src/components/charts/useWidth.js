import { useEffect, useState } from 'react'

// Render charts at their real pixel width so text stays at real sizes on phones.
export function useWidth(ref, initial = 680) {
  const [w, setW] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}
