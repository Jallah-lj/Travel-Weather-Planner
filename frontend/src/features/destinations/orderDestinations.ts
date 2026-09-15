import type { Destination } from '../../types'

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true, ignorePunctuation: true })
const clean = (value: string) => value.trim().normalize('NFC')

/** Stable A–Z browsing order. Never mutate query data or merge distinct locations. */
export function orderDestinations(destinations: Destination[]): Destination[] {
  const unique = [...new Map(destinations.map(item => [item.id, item])).values()]
  return unique.sort((a,b) =>
    collator.compare(clean(a.name), clean(b.name)) ||
    collator.compare(clean(a.country), clean(b.country)) ||
    collator.compare(a.destination_type || '', b.destination_type || '') ||
    a.latitude - b.latitude || a.longitude - b.longitude || a.id.localeCompare(b.id))
}

export function destinationDescription(item: Destination, destinations: Destination[]): string {
  const duplicateName = destinations.some(other => other.id !== item.id && collator.compare(clean(other.name),clean(item.name)) === 0 && collator.compare(clean(other.country),clean(item.country)) === 0)
  const country = collator.compare(clean(item.name),clean(item.country)) === 0 ? 'Country' : item.country
  if (!duplicateName) return country
  const kind = (item.destination_type || 'location').replaceAll('_',' ')
  return `${country} · ${kind} · ${item.latitude.toFixed(3)}°, ${item.longitude.toFixed(3)}°`
}
