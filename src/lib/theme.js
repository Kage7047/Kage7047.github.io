import { useSyncExternalStore } from 'react'

// 'auto' follows the OS; 'light' / 'dark' are remembered. index.html applies it before first paint.
const KEY = 'kage-theme'
const listeners = new Set()
const read = () => {
  if (typeof document === 'undefined') return 'auto'
  return document.documentElement.dataset.theme || 'auto'
}
export function setTheme(value) {
  const d = document.documentElement
  if (value === 'auto') delete d.dataset.theme
  else d.dataset.theme = value
  try {
    if (value === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  listeners.forEach((l) => l())
}
const subscribe = (cb) => (listeners.add(cb), () => listeners.delete(cb))
export const useTheme = () => useSyncExternalStore(subscribe, read, () => 'auto')
