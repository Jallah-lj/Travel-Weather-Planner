import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle({ light = false }: { light?: boolean }) {
  const { resolved, setTheme } = useTheme()
  const label = `Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`
  return <button type="button" aria-label={label} title={label} onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber ${light ? 'border-white/25 text-white hover:bg-white/10' : 'border-black/10 bg-white text-ink hover:bg-cream'}`}>{resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
}
export function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  return <fieldset className="mb-8 rounded-2xl border border-black/10 bg-cream p-5"><legend className="px-2 text-sm font-semibold">Appearance</legend><p className="mb-4 text-sm text-slate">Choose your theme. Your preference is saved on this device.</p><div className="flex flex-wrap gap-3">{([{ value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }, { value: 'system', label: 'System', icon: Monitor }] as const).map(({ value, label, icon: Icon }) => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${theme === value ? 'border-forest bg-forest text-white' : 'border-black/10 bg-white text-ink'}`}><input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} className="accent-emerald-600" /><Icon size={17} />{label}</label>)}</div></fieldset>
}
