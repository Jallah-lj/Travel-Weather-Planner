import { JourneyOverview } from '../features/journey/JourneyOverview'
import { planStops, stopForDate } from '../features/journey/journey'
import type { PrivatePlan } from '../types'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Logo } from '../components/brand/Logo'
import { Skeleton } from '../components/ui/Skeleton'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { PrivateTripEditor } from './TripDashboardPage'

export function SharedTripPage() {
  const location = useLocation()
  // Fragment tokens are not transmitted in page URLs, server access logs, or referrers.
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || ''
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token)
  const query = useQuery({ queryKey: ['shared-trip', token], queryFn: () => api.getSharedPlan(token), enabled: valid, retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchInterval: value => value.state.data?.permission === 'view' ? 30000 : false })
  useEffect(() => {
    document.title = 'Shared trip · Travel Weather'
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow, noarchive'; document.head.append(robots)
    return () => { robots.remove() }
  }, [])
  return <div className="min-h-screen bg-cream text-ink"><header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6"><Logo /><ThemeToggle /></header><main className="mx-auto max-w-6xl px-5 pb-16 pt-5 md:px-8">
    {!valid || query.isError ? <section className="rounded-2xl border border-black/10 bg-white p-8"><h1 className="text-3xl font-semibold">Cannot open this shared trip</h1><p className="mt-4 text-slate">{query.error?.message || 'The link is missing or invalid. Ask the owner for a new sharing link.'}</p><p className="mt-3 text-sm text-slate">Links can expire or be revoked by the owner.</p></section> : query.isLoading || !query.data ? <Skeleton className="h-80 w-full rounded-2xl" /> : <><p className="mb-6 rounded-xl border border-black/10 bg-white p-4 text-sm text-slate">This link grants {query.data.permission === 'view' ? 'view-only' : 'editing'} access until {new Date(query.data.expires_at).toLocaleString()}. Keep it private. Shared views do not include live weather or maps.</p>{query.data.permission === 'view' ? <SharedReadOnlyPlan plan={query.data.plan} /> : <PrivateTripEditor key={query.data.plan.trip_id} initial={query.data.plan} shareToken={token} readOnly={false} />}</>}
  </main></div>
}

function SharedReadOnlyPlan({ plan }: { plan: PrivatePlan }) {
  const stops=planStops(plan)
  return <><p className="eyebrow">Shared trip · View only</p><h1 className="mt-3 text-4xl font-semibold">{plan.destination.flag} {plan.title}</h1><p className="mt-3 text-sm text-slate">{plan.departure_date} – {plan.return_date} · Times are local to each stop.</p><JourneyOverview stops={stops}/><h2 className="mt-8 text-2xl font-semibold">Itinerary</h2>{plan.itinerary.map(day => <section key={day.date} className="mt-4 rounded-2xl border border-black/10 bg-white p-5"><h3 className="font-semibold">{day.date} · {day.label} · {stopForDate(stops,day.date).destination.name}</h3><p className="mt-1 text-xs text-slate">{stopForDate(stops,day.date).destination.timezone}</p>{day.items.length ? <ul className="mt-4 space-y-3">{day.items.map(item => <li key={item.id} className="flex items-start gap-4"><time className="shrink-0 font-semibold text-forest">{item.time}</time><span className="break-words">{item.title}</span>{item.duration_minutes!=null&&<span className="text-xs text-slate">{item.duration_minutes} min</span>}</li>)}</ul> : <p className="mt-3 text-sm text-slate">No activities planned.</p>}</section>)}<h2 className="mt-8 text-2xl font-semibold">Packing checklist</h2><ul className="mt-4 space-y-3 rounded-2xl border border-black/10 bg-white p-5">{plan.packing.map(item => <li key={item.id} className="flex flex-wrap items-center gap-3 border-b border-black/10 pb-3"><span className="rounded-lg bg-cream px-2 py-1 text-xs text-slate">{item.packed ? 'Packed' : 'To pack'}</span><span className="flex-1">{item.name}</span><span className="text-sm text-slate">× {item.quantity}</span></li>)}{!plan.packing.length && <li>No packing items.</li>}</ul></>
}
