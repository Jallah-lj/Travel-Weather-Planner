import { describe, expect, it } from 'vitest'
import { destinationDescription, orderDestinations } from './orderDestinations'
import type { Destination } from '../../types'
const place=(id:string,name:string,country='Rwanda',latitude=0):Destination=>({id,name,country,country_code:'RW',flag:'🇷🇼',latitude,longitude:30,timezone:'Africa/Kigali',destination_type:'city'})
describe('destination order',()=>{
 it('sorts names A–Z with accent/case normalization and leaves the input unchanged',()=>{
  const input=[place('z','Zürich'),place('s','São Paulo'),place('a',' accra '),place('k','Kigali')]
  expect(orderDestinations(input).map(x=>x.id)).toEqual(['a','k','s','z'])
  expect(input.map(x=>x.id)).toEqual(['z','s','a','k'])
 })
 it('inserts new selected destinations into alphabetical order',()=>{
  expect(orderDestinations([place('p','Paris'),place('z','Zürich'),place('b','Berlin')]).map(x=>x.name)).toEqual(['Berlin','Paris','Zürich'])
 })
 it('removes repeated IDs but preserves and distinguishes real same-name locations',()=>{
  const ca=place('c','London','Canada',43),gb=place('g','London','United Kingdom',51),station=place('s','London','United Kingdom',52)
  const result=orderDestinations([gb,station,ca,gb])
  expect(result.map(x=>x.id)).toEqual(['c','g','s'])
  expect(destinationDescription(gb,result)).toContain('51.000°')
  expect(destinationDescription(station,result)).toContain('52.000°')
 })
})
