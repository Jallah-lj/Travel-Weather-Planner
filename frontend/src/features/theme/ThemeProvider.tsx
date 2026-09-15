import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'
const key = 'travel-weather:theme'
const ThemeContext = createContext<{ theme: Theme; resolved: 'light' | 'dark'; setTheme: (theme: Theme) => void } | null>(null)
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => { try { const stored = localStorage.getItem(key); return stored === 'light' || stored === 'dark' ? stored : 'system' } catch { return 'system' } })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => setSystemDark(media.matches)
    media.addEventListener('change', listener)
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) setTheme(event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system') }
    window.addEventListener('storage', sync)
    return () => { media.removeEventListener('change', listener); window.removeEventListener('storage', sync) }
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#101914' : '#f5f2e9')
    try { localStorage.setItem(key, theme) } catch { /* Theme still works without storage. */ }
  }, [theme, resolved])
  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
}
export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('ThemeProvider is required')
  return value
}
