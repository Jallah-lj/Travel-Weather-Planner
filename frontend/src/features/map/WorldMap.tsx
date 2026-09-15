import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
maplibregl.setWorkerUrl(mapWorkerUrl)
import { Globe2, RefreshCw } from 'lucide-react'
import { mapConfig, validCoordinates } from './config'
import type { Destination } from '../../types'

export function WorldMap({ destinations, selected, onSelect }: { destinations: Destination[]; selected: Destination | null; onSelect: (destination: Destination) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, maplibregl.Marker>())
  const select = useRef(onSelect); select.current = onSelect
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!container.current || mapConfig.error) return
    setError(''); setLoaded(false)
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({ container: container.current, style: mapConfig.style, center: [30.0619, -1.9441], zoom: 12.5, minZoom: 0, maxZoom: 19, attributionControl: { compact: false }, renderWorldCopies: false })
    } catch { setError('The interactive map could not start. Enable WebGL in your browser or try another browser.'); return }
    map.current = instance
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    instance.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false, timeout: 10000 }, trackUserLocation: false, showAccuracyCircle: true }), 'top-left')
    instance.on('load', () => { setLoaded(true); setError('') })
    instance.on('error', () => { setError('Map data could not load. The provider may be unavailable or blocked on your network.') })
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container.current)
    return () => { observer.disconnect(); instance.remove(); map.current = null }
  }, [attempt])
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    destinations.forEach(destination => {
      if (!validCoordinates(destination.latitude, destination.longitude)) return
      const button = document.createElement('button')
      button.type = 'button'; button.className = 'geographic-marker'
      button.setAttribute('aria-label', `View ${destination.name} weather`)
      button.title = `${destination.name}, ${destination.country}`
      const pin = document.createElement('span'); pin.className = 'destination-pin'
      pin.append(document.createElement('span')); button.append(pin)
      button.onclick = () => select.current(destination)
      const marker = new maplibregl.Marker({ element: button, anchor: 'bottom' }).setLngLat([destination.longitude, destination.latitude]).addTo(instance)
      markers.current.set(destination.id, marker)
    })
    return () => { markers.current.forEach(marker => marker.remove()); markers.current.clear() }
  }, [destinations, attempt])
  useEffect(() => {
    markers.current.forEach((marker, id) => {
      marker.getElement().querySelector('.destination-pin')?.classList.toggle('is-selected', id === selected?.id)
      marker.getElement().setAttribute('aria-pressed', String(id === selected?.id))
    })
    if (selected && validCoordinates(selected.latitude, selected.longitude)) {
      map.current?.jumpTo({ center: [selected.longitude, selected.latitude], zoom: 14 })
    }
  }, [selected, destinations, attempt])
  if (mapConfig.error) return <div role="alert" className="p-8 text-sm">{mapConfig.error}</div>
  return <div className="world-map map-preserved-frame relative isolate min-w-0 self-start">
    <div ref={container} className="map-preserved-canvas" role="region" aria-label="Interactive geographic map" />
    <button type="button" onClick={() => map.current?.fitBounds([[-180, -60], [180, 80]], { padding: 20, duration: 0 })} className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-ink shadow" aria-label="Reset to world view"><Globe2 size={16} />World view</button>
    {!loaded && !error && <div role="status" className="pointer-events-none absolute bottom-12 left-3 rounded-xl bg-white px-4 py-3 text-xs text-ink shadow">Loading geographic map…</div>}
    {error && <div role="alert" className="absolute bottom-12 left-3 right-3 z-10 rounded-xl border border-black/10 bg-white p-4 text-sm text-ink shadow"><p>{error}</p><button type="button" className="mt-2 flex items-center gap-2 font-semibold underline" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={14} />Retry map</button></div>}
  </div>
}
