import type { ActivityRoute, ItineraryItem } from '../../types'
const travelMode = (mode: string) => ({ DRIVE:'driving', WALK:'walking', BICYCLE:'bicycling' }[mode] || 'driving')
function coordinates(point: { latitude:number; longitude:number }) {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude)>90 || Math.abs(point.longitude)>180) throw new Error('Invalid destination coordinates')
  return `${point.latitude},${point.longitude}`
}
/** Opens Google's own directions UI. No API keys, trip titles or private tokens. */
export function directionsToPin(point: { latitude:number; longitude:number }) {
  const url=new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api','1');url.searchParams.set('destination',coordinates(point))
  return url.toString()
}
/** One leg per URL: no silent loss of waypoints on mobile. */
export function directionsForLeg(route:ActivityRoute,items:ItineraryItem[],index:number) {
  const leg=route.legs[index]
  if(!leg || !items[index] || !items[index+1]) throw new Error('Route leg unavailable')
  const url=new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api','1');url.searchParams.set('origin',coordinates(leg.start));url.searchParams.set('destination',coordinates(leg.end));url.searchParams.set('travelmode',travelMode(route.mode))
  if(items[index].location?.provider==='google')url.searchParams.set('origin_place_id',items[index].location!.place_id)
  if(items[index+1].location?.provider==='google')url.searchParams.set('destination_place_id',items[index+1].location!.place_id)
  return url.toString()
}
