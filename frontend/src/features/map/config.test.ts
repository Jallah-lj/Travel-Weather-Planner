import { describe, expect, it } from 'vitest'
import { validCoordinates, mapConfig } from './config'

describe('map geographic data', () => {
  it('accepts actual WGS84 locations, including zero coordinates', () => {
    expect(validCoordinates(-1.9441, 30.0619)).toBe(true)
    expect(validCoordinates(0, 0)).toBe(true)
    expect(validCoordinates(-90, 180)).toBe(true)
  })
  it('rejects invalid coordinates without fabricating replacements', () => {
    for (const [lat, lon] of [[NaN, 30], [90.1, 30], [0, Infinity], [0, -181]]) expect(validCoordinates(lat, lon)).toBe(false)
  })
  it('uses a real attributed provider', () => {
    expect(mapConfig.style).toBe('https://tiles.openfreemap.org/styles/liberty')
    expect(mapConfig.name).toBe('OpenFreeMap')
  })
})
