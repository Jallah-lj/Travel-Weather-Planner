import { directionsToPin } from '../features/routing/directionsLinks'
import { DestinationPicker } from '../features/destinations/DestinationPicker'
import { DestinationSearch } from '../features/destinations/DestinationSearch'
import { mapConfig, validCoordinates } from '../features/map/config'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Globe2, Info, MapPin, Navigation } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../layouts/AppShell'
import { WeatherIcon } from '../components/ui/WeatherIcon'
import { Skeleton } from '../components/ui/Skeleton'
import { WorldMap } from '../features/map/WorldMap'
import { api } from '../services/api'
import type { Destination } from '../types'

const emptyDestinations: Destination[] = []
export function WeatherMapPage() {
  const [selected, setSelected] = useState<Destination | null>(null)
  const destinations = useQuery({ queryKey: ['destinations', ''], queryFn: () => api.searchDestinations(''), staleTime: 600_000 })
  const locations = useMemo(() => [...(destinations.data || emptyDestinations), ...(selected && !destinations.data?.some(item => item.id === selected.id) ? [selected] : [])].filter(item => validCoordinates(item.latitude, item.longitude)), [destinations.data, selected])
  const weather = useQuery({ queryKey: ['map-weather-source', selected?.id], queryFn: () => api.getMapWeather(selected!.latitude, selected!.longitude), enabled: Boolean(selected), staleTime: 600_000 })
  const conditions = weather.data?.data
  const provider = weather.data?.meta?.provider
  const isMock = provider === 'development_mock'
  const today = new Date(); const end = new Date(today); end.setDate(end.getDate() + 3)
  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return <AppShell><main className="mx-auto max-w-[1500px] px-5 pb-28 pt-8 md:px-8 lg:px-10 lg:pb-16 lg:pt-10">
    <Link to="/app/explore" className="inline-flex items-center gap-2 text-xs font-bold text-forest"><ArrowLeft size={14} />Back to explore</Link>
    <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="eyebrow">A world of possibilities</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">Weather map</h1><p className="mt-3 text-sm text-slate">Explore real streets, neighborhoods, and landmarks. Select a destination to see local conditions.</p></div><span className="flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-forest"><Globe2 size={15} />{mapConfig.name}</span></div>
    <section className="mt-7 grid overflow-hidden rounded-2xl border border-black/8 bg-white shadow-card xl:grid-cols-[minmax(0,1fr)_330px] items-start" aria-label="Map and destination conditions">
      <WorldMap destinations={locations} selected={selected} onSelect={setSelected} />
      <aside className="map-location-panel min-w-0 border-t border-black/8 p-6 xl:border-l xl:border-t-0"><div className="mb-6"><DestinationSearch value={selected} onSelect={setSelected} /></div>{destinations.isLoading ? <Skeleton className="h-16 w-full rounded-xl" /> : <DestinationPicker value={selected} destinations={locations} onSelect={setSelected} />}
        {destinations.isError && <div role="alert" className="mt-4 text-sm text-slate">Destinations could not be loaded. <button className="font-semibold underline" onClick={() => destinations.refetch()}>Retry</button></div>}
        {!selected ? <div className="py-12"><MapPin size={30} className="text-forest" /><h2 className="mt-5 text-xl font-semibold">Where will you go?</h2><p className="mt-3 text-sm leading-6 text-slate">The map opens in central Kigali. Choose a destination to jump to its streets, or use World view to explore globally. Building outlines and landmarks appear as you zoom in.</p></div> : <>
          <div className="mt-6 flex items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">{selected.flag} {selected.name}</h2><p className="mt-2 text-xs text-slate">{selected.country}</p><p className="mt-2 font-mono text-[10px] text-slate">{Math.abs(selected.latitude).toFixed(4)}° {selected.latitude < 0 ? 'S' : 'N'} · {Math.abs(selected.longitude).toFixed(4)}° {selected.longitude < 0 ? 'W' : 'E'}</p></div>{conditions && <WeatherIcon name={conditions.icon} className="h-10 w-10 shrink-0" />}</div>
          <div className="mt-5 space-y-2"><a href={directionsToPin(selected)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white"><Navigation size={16}/>Directions to this pin <ExternalLink size={14}/></a><Link to="/planner" state={{ destination: selected, departure: formatDate(today), returnDate: formatDate(end) }} className="flex min-h-11 items-center justify-center rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold text-forest">Plan a trip here</Link><p className="text-[11px] leading-5 text-slate">Directions open in Google Maps, where you choose a starting point. This pin may be a city/country reference point—not a building entrance.</p></div>
          {weather.isLoading ? <Skeleton className="mt-6 h-48 w-full rounded-xl" /> : weather.isError ? <div role="alert" className="mt-6 rounded-xl border border-black/10 p-4 text-sm">Weather is unavailable. <button className="font-semibold underline" onClick={() => weather.refetch()}>Try again</button></div> : conditions && <>
            <p className="mt-5 rounded-lg bg-cream px-3 py-2 text-xs font-semibold text-forest">{isMock ? 'Demo weather · Not live observations' : `Weather source: ${typeof provider === 'string' ? provider : 'Not supplied'}`}</p>
            <div className="mt-5 text-5xl font-light tracking-[-.06em]">{conditions.temperature}<span className="align-top text-xl tracking-normal"> °C</span></div><p className="mt-2 text-sm font-semibold">{conditions.condition}</p><p className="mt-1 text-xs text-slate">Feels like {conditions.feels_like} °C</p>
            <div className="mt-5 grid grid-cols-2 gap-2">{[['Rain', `${conditions.precipitation}%`], ['Wind', `${conditions.wind} km/h`], ['Humidity', `${conditions.humidity}%`], ['UV index', `${conditions.uv}`]].map(([label, value]) => <div key={label} className="rounded-lg bg-cream p-3"><span className="text-[10px] text-slate">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>)}</div>
          </>}
          
        </>}
      </aside>
    </section>
    <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate"><Info size={15} className="mt-0.5 shrink-0" /><p>Drag to pan; scroll, pinch, or use + / − to zoom. Map tiles require an internet connection. Markers show destination locations, not radar or weather coverage. Weather guidance is not a guarantee.</p></div>
  </main></AppShell>
}
