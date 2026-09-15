import { MobileMenu } from '../components/navigation/MobileMenu'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { clearSession, getSession } from '../features/auth/session'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Bell, CalendarRange, CloudSun, Compass, Home, Luggage, MapPinned, LogOut, Menu, Plus, Search, Settings, UserRound } from 'lucide-react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Logo } from '../components/brand/Logo'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/cn'

const workspace = [
  { label: 'Dashboard', icon: Home, to: '/app' },
  { label: 'Trips', icon: CalendarRange, to: '/app/trips' },
  { label: 'Explore', icon: Compass, to: '/app/explore' },
]

export function AppShell({ children }: { children: ReactNode; active?: string }) {
  const queryClient = useQueryClient()
  const user = getSession()?.user
  const name = user?.display_name || user?.email.split('@')[0] || 'Traveler'
  const navigate = useNavigate(); const location = useLocation(); const params = useParams()
  const [logoutError,setLogoutError]=useState('')
  const logout = async () => {try{await clearSession();queryClient.clear();navigate('/login',{replace:true})}catch(error){setLogoutError(error instanceof Error?error.message:'Please retry sign out.')}}
  const tripId = params.tripId || (location.pathname.startsWith('/trip/') ? location.pathname.split('/')[2] : null)
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); navigate('/app/explore') } }
    window.addEventListener('keydown', openSearch)
    return () => window.removeEventListener('keydown', openSearch)
  }, [navigate])
  const tripTools = tripId ? [
    { label: 'Trip overview', icon: MapPinned, to: `/trip/${tripId}` },
    { label: 'Weather', icon: CloudSun, to: `/trip/${tripId}#weather` },
    { label: 'Itinerary', icon: CalendarRange, to: `/trip/${tripId}#itinerary` },
    { label: 'Directions', icon: MapPinned, to: `/trip/${tripId}#directions` },
    { label: 'Packing', icon: Luggage, to: `/trip/${tripId}#packing` },
  ] : []
  const itemClass = ({ isActive }: { isActive: boolean }) => cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-forest text-white' : 'text-slate hover:bg-black/5 hover:text-ink')
  return <div className="app-shell min-h-screen bg-[#f2f1eb] text-ink">
    <aside className="workspace-sidebar fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-black/8 bg-[#faf9f5] px-5 py-6 lg:flex">
      <Logo />
      <Button className="mt-8 w-full" onClick={() => navigate('/planner')}><Plus size={17} /> New trip</Button>
      <p className="mb-2 mt-8 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-slate/70">Workspace</p>
      <nav className="space-y-1" aria-label="Workspace navigation">{workspace.map(({ label, icon: Icon, to }) => <NavLink key={label} to={to} end={to === '/app'} className={itemClass}><Icon size={18} />{label}</NavLink>)}</nav>
      {tripTools.length > 0 && <><div className="my-5 h-px bg-black/8" /><p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-slate/70">Current trip</p><nav className="space-y-1" aria-label="Current trip navigation">{tripTools.map(({ label, icon: Icon, to }, index) => <NavLink key={label} to={to} end={index === 0} className={({ isActive }) => cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', isActive && ((index === 0 && !location.hash) || (index > 0 && location.hash === new URL(to, window.location.origin).hash)) ? 'bg-forest/8 text-forest' : 'text-slate hover:bg-black/5 hover:text-ink')}><Icon size={17} />{label}</NavLink>)}</nav></>}
      <div className="mt-auto space-y-3"><NavLink to="/app/settings" className={itemClass}><Settings size={17} />Settings</NavLink><NavLink to="/app/settings" className="block rounded-xl bg-[#edeae0] p-3 transition hover:bg-[#e5e2d7]"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-forest text-sm font-bold text-white">{name[0].toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{name}</span><span className="block text-[11px] text-slate">Travel preferences</span></span><Settings size={15} className="ml-auto text-slate" /></div></NavLink><div className="border-t border-black/10 pt-3"><button type="button" onClick={logout} className="account-logout"><LogOut size={17} /><span>Log out</span></button></div></div>
    </aside>
    <div className="lg:pl-[232px]">
      <header className="workspace-header sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/8 bg-[#f2f1eb]/95 px-5 backdrop-blur-md md:px-8 lg:h-[72px] lg:px-10">
        <div className="lg:hidden"><Logo compact to="/app" /></div>
        <button onClick={() => navigate('/app/explore')} className="hidden h-10 min-w-[260px] items-center gap-3 rounded-lg border border-black/8 bg-white px-3 text-left text-sm text-slate transition hover:border-forest/25 md:flex"><Search size={16} />Search destinations or trips <kbd className="ml-auto rounded border border-black/10 px-1.5 py-0.5 text-[10px]">⌘ K</kbd></button>
        <div className="workspace-actions flex items-center gap-2"><ThemeToggle /><button onClick={() => navigate('/app/notifications')} className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-slate shadow-sm hover:text-ink" aria-label="Notifications"><Bell size={18} /></button><button onClick={() => navigate('/app/settings')} className="grid h-10 w-10 place-items-center rounded-full bg-forest font-bold text-white lg:hidden" aria-label="Profile and settings"><UserRound size={17} /></button><MobileMenu onLogout={logout} accountName={name} email={user?.email} /></div>
      </header>
      {logoutError&&<p role="alert" className="mx-5 mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{logoutError}</p>}
      {children}
    </div>
    <nav className="mobile-workspace-nav fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 items-center border-t border-black/8 bg-white px-2 lg:hidden" aria-label="Mobile navigation">{[
      { label: 'Home', icon: Home, to: '/app' }, { label: 'Trips', icon: CalendarRange, to: '/app/trips' }, { label: 'Explore', icon: Compass, to: '/app/explore' }, { label: 'Weather', icon: CloudSun, to: '/app/weather-map' }, { label: 'Profile', icon: UserRound, to: '/app/settings' }
    ].map(({ label, icon: Icon, to }) => <NavLink key={label} to={to} end={to === '/app'} className={({ isActive }) => cn('flex min-w-14 flex-col items-center gap-1 text-[10px] font-semibold', isActive ? 'text-forest' : 'text-slate')}><Icon size={19} />{label}</NavLink>)}</nav>
  </div>
}
