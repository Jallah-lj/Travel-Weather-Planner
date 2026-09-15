import { describe, it, expect } from 'vitest'
import { directionsForLeg, directionsToPin } from './directionsLinks'
import type { ActivityRoute, ItineraryItem } from '../../types'
describe('Google Maps directions URLs',()=>{
 it('opens selected coordinates without requiring weather or a key',()=>{
  const url=new URL(directionsToPin({latitude:-1.9441,longitude:30.0619}))
  expect(url.origin).toBe('https://www.google.com')
  expect(url.searchParams.get('destination')).toBe('-1.9441,30.0619')
  expect(url.searchParams.get('api')).toBe('1')
  expect(url.searchParams.has('origin')).toBe(false)
  expect(url.searchParams.has('key')).toBe(false)
 })
 it.each([['DRIVE','driving'],['WALK','walking'],['BICYCLE','bicycling']])('preserves %s and real place references',(mode,expected)=>{
  const route={mode,legs:[{start:{latitude:1,longitude:2},end:{latitude:3,longitude:4}}]} as ActivityRoute
  const items=[{location:{provider:'google',place_id:'origin / ID'},title:'Private title'},{location:{provider:'google',place_id:'destination ID'}}] as ItineraryItem[]
  const url=new URL(directionsForLeg(route,items,0))
  expect(url.searchParams.get('travelmode')).toBe(expected)
  expect(url.searchParams.get('origin_place_id')).toBe('origin / ID')
  expect(url.searchParams.get('destination_place_id')).toBe('destination ID')
  expect(url.toString()).not.toContain('Private')
 })
 it('rejects invalid coordinates',()=>expect(()=>directionsToPin({latitude:NaN,longitude:2})).toThrow())
})
