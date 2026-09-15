import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bell, CalendarRange, CloudSun, Compass, GitCompareArrows, Heart, Home, LogOut, Menu, Plus, Settings, X } from 'lucide-react'
import { Logo } from '../brand/Logo'

const links = [
  { label: 'Dashboard', to: '/app', icon: Home },
  { label: 'My trips', to: '/app/trips', icon: CalendarRange },
  { label: 'Explore destinations', to: '/app/explore', icon: Compass },
  { label: 'Saved destinations', to: '/app/saved', icon: Heart },
  { label: 'Compare destinations', to: '/app/compare', icon: GitCompareArrows },
  { label: 'Weather map', to: '/app/weather-map', icon: CloudSun },
  { label: 'Notifications', to: '/app/notifications', icon: Bell },
  { label: 'Settings', to: '/app/settings', icon: Settings },
]
export function MobileMenu({ onLogout, accountName, email }: { onLogout: () => void; accountName: string; email?: string }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  useEffect(() => { setOpen(false) }, [location.pathname, location.hash])
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (!open) { if (element.open) element.close(); return }
    element.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const wide = window.matchMedia('(min-width: 1024px)')
    const resize = () => { if (wide.matches) setOpen(false) }
    wide.addEventListener('change', resize)
    return () => { document.body.style.overflow = previous; wide.removeEventListener('change', resize); if (element.open) element.close() }
  }, [open])
  return <>
    <button ref={trigger} type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate hover:bg-black/5 lg:hidden" aria-label="Open navigation menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-navigation-dialog"><Menu size={20} /></button>
    <dialog ref={dialog} id="mobile-navigation-dialog" className="mobile-menu-dialog" aria-labelledby="mobile-menu-title" onCancel={() => setOpen(false)} onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }} onClick={event => { if (event.target === dialog.current) { const bounds = dialog.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false) } }}>
      <div className="mobile-menu-header"><Logo /><button type="button" autoFocus className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate hover:bg-black/5" aria-label="Close navigation menu" onClick={() => setOpen(false)}><X size={21} /></button></div>
      <div className="mobile-menu-body"><h2 id="mobile-menu-title" className="text-2xl font-semibold tracking-tight">Your workspace</h2><p className="mt-2 text-sm text-slate">Everything you need for your next trip.</p>
        <NavLink to="/planner" onClick={() => setOpen(false)} className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white"><Plus size={18} />Plan a new trip</NavLink>
        <nav className="mt-6 space-y-1" aria-label="Full mobile navigation">{links.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === '/app'} onClick={() => setOpen(false)} className={({ isActive }) => `mobile-menu-link ${isActive ? 'is-active' : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      </div>
      <div className="mobile-menu-footer"><div className="mb-3 min-w-0"><p className="truncate text-sm font-semibold text-ink">{accountName}</p><p className="mt-1 truncate text-xs text-slate">{email}</p></div><button type="button" className="account-logout" onClick={() => { setOpen(false); onLogout() }}><LogOut size={18} /><span>Log out</span></button></div>
    </dialog>
  </>
}
