/** WGS84 coordinates only; never substitute fictional locations. */
export function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}
const style = import.meta.env.VITE_MAP_STYLE_URL?.trim() || 'https://tiles.openfreemap.org/styles/liberty'
let valid = false
try { valid = new URL(style).protocol === 'https:' } catch { /* invalid configuration */ }
export const mapConfig = {
  error: valid ? null : 'Map style must be an HTTPS MapLibre style URL.',
  style,
  name: import.meta.env.VITE_MAP_PROVIDER_NAME?.trim() || 'OpenFreeMap',
}
