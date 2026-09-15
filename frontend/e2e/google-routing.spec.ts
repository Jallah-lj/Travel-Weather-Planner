import { test, expect } from '@playwright/test'

async function createTrip(page:any,request:any){
 const response=await request.post('/api/v1/auth/register',{data:{email:`routes-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,password:'Google-routing-test42',display_name:'Routing Test'}})
 const session=(await response.json()).data;const headers={Authorization:`Bearer ${session.access_token}`}
 const places=(await(await request.get('/api/v1/destinations/search')).json()).data
 const created=await request.post('/api/v1/trips',{headers,data:{destination_id:places[0].id,departure_date:'2026-09-15',return_date:'2026-09-15',initial_plan:{itinerary:[{date:'2026-09-15',label:'Tuesday',items:[{id:'a',time:'09:00',title:'Morning visit',category:'custom'},{id:'b',time:'10:10',title:'Lunch stop',category:'food'}]}],packing:[]}}})
 expect(created.status()).toBe(201);const id=(await created.json()).data.id
 await page.addInitScript((s:any)=>sessionStorage.setItem('travel-weather-session',JSON.stringify({...s,expiresAt:Date.now()+600000})),session)
 return {id,headers}
}

for(const embeddedMap of [true,false]) test(`Google directions workflow with embedded map ${embeddedMap}`, async({page,request})=>{
 test.setTimeout(60000)
 const {id,headers}=await createTrip(page,request)
 await page.route('**/api/v1/routing/config',route=>route.fulfill({json:{success:true,data:{provider:'Google Maps Platform',places_available:true,routing_available:true,map_available:embeddedMap,browser_key:embeddedMap?'public-browser-test-key':'',max_activities:10,limits:{routes_per_minute:6,routes_per_day:100,places_per_minute:30,places_per_day:300},note:'Mock test config'}}}))
 const sessions:string[]=[]
 await page.route('**/places/search',route=>{const data=route.request().postDataJSON();sessions.push(data.session_token);return route.fulfill({json:{success:true,data:[{place_id:'place-'+data.query,text:'Test Google result '+data.query}]}})})
 await page.route('**/places/details',route=>{const data=route.request().postDataJSON();expect(sessions).toContain(data.session_token);return route.fulfill({json:{success:true,data:{place_id:data.place_id,name:'Test Google place',address:'Test-only address',latitude:1,longitude:2,attributions:[]}}})})
 await page.route('https://maps.googleapis.com/maps/api/js?*',route=>route.fulfill({contentType:'application/javascript',body:`
 class FakeMap {constructor(node){this.node=node;node.dataset.testid='google-sdk-test-map'}fitBounds(){} }
 class LatLng {constructor(lat,lng){this.lat=lat;this.lng=lng}}
 class OverlayView {setMap(map){this.map=map;if(map){this.onAdd();this.draw()}else this.onRemove()}getPanes(){return {overlayMouseTarget:this.map.node}}getProjection(){return {fromLatLngToDivPixel:()=>({x:100,y:100})}}}
 window.google={maps:{Map:FakeMap,LatLng,OverlayView,Polyline:class {constructor(options){window.__routePolylineDrawn=options.path.length}setMap(){}},LatLngBounds:class {extend(){}},InfoWindow:class {open(){}},geometry:{encoding:{decodePath:()=>[new LatLng(1,2),new LatLng(3,4)]}},event:{trigger(){},clearInstanceListeners(){}}}};window.travelGoogleReady();`}))
 await page.route(`**/trips/${id}/route`,route=>{const data=route.request().postDataJSON();expect(data.buffer_minutes).toBe(10);return route.fulfill({json:{success:true,data:{provider:'Google Maps',mode:'DRIVE',distance_meters:5000,duration_seconds:1200,polyline:'test-only',legs:[{duration_seconds:1200,distance_meters:5000,start:{latitude:1,longitude:2},end:{latitude:3,longitude:4}}],warnings:[],activity_ids:['a','b'],generated_at:new Date().toISOString(),notice:'Test fixture, not live directions.',schedule:{status:'conflicts',issues:[{code:'travel_gap',message:'Allow at least 20 more minutes before Lunch stop.'}],segments:[],travel_checked:true,note:'Test estimate.'}}}})})
 await page.goto(`/trip/${id}`)
 await page.getByRole('navigation',{name:'Trip sections'}).getByRole('link',{name:'Directions',exact:true}).click()
 await expect(page).toHaveURL(/#directions$/)
 await expect(page.locator('#directions')).toBeFocused()
 await page.getByRole('link',{name:'Edit activity locations'}).click()
 await expect(page.locator('#itinerary')).toBeFocused()
 for(let i=0;i<2;i++){
  await page.getByLabel(`Activity ${i+1} duration`,{exact:true}).fill(i===0?'60':'30')
  await page.getByRole('button',{name:'Choose activity location',exact:true}).nth(i).click()
  await page.getByRole('combobox',{name:'Search Google places'}).fill(i===0?'museum':'cafe')
  await page.getByRole('option',{name:/Test Google result/}).click()
 }
 expect(sessions[0]).not.toBe(sessions[1])
 await expect(page.getByRole('button',{name:'Calculate directions',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Save all changes',exact:true}).first().click()
 await expect(page.getByText('All changes saved to your account.')).toBeVisible()
 const saved=(await(await request.get(`/api/v1/trips/${id}/plan`,{headers})).json()).data
 expect(saved.itinerary[0].items[0].location).toEqual({provider:'google',place_id:'place-museum'})
 expect(JSON.stringify(saved)).not.toContain('Test-only address')
 await page.getByRole('button',{name:'Calculate directions',exact:true}).click()
 await expect(page.getByText('Timing conflicts found')).toBeVisible()
 await expect(page.getByText('Allow at least 20 more minutes before Lunch stop.')).toBeVisible()
 if(embeddedMap){await expect(page.getByTestId('google-sdk-test-map')).toBeVisible();expect(await page.evaluate(()=>(window as any).__routePolylineDrawn)).toBe(2)}
 else await expect(page.getByText('Place search and route estimates are connected')).toBeVisible()
 const navigation=page.getByRole('link',{name:'Open leg 1 in Google Maps'})
 await expect(navigation).toBeVisible()
 const url=new URL((await navigation.getAttribute('href'))!)
 expect(url.origin).toBe('https://www.google.com')
 expect(url.searchParams.get('origin_place_id')).toBe('place-museum')
 expect(url.searchParams.get('destination_place_id')).toBe('place-cafe')
 expect(url.searchParams.get('travelmode')).toBe('driving')
 expect(url.searchParams.has('key')).toBe(false)
 await page.getByLabel('Activity 2 time').fill('11:30')
 await expect(page.getByTestId('google-sdk-test-map')).toHaveCount(0)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await request.delete(`/api/v1/trips/${id}`,{headers})
})

test('schedule-only checks work without Google credentials',async({page,request})=>{
 const {id,headers}=await createTrip(page,request)
 await page.route('**/api/v1/routing/config',route=>route.fulfill({json:{success:true,data:{places_available:false,routing_available:false,browser_key:'',map_available:false,max_activities:10,limits:{routes_per_minute:6,routes_per_day:100,places_per_minute:30,places_per_day:300}}}}))
 await page.goto(`/trip/${id}`)
 await expect(page.getByText('Google Maps Platform setup required')).toBeVisible()
 await page.getByLabel('Activity 1 duration',{exact:true}).fill('120')
 await page.getByLabel('Activity 2 duration',{exact:true}).fill('60')
 await page.getByRole('button',{name:'Save all changes'}).first().click()
 await expect(page.getByText('All changes saved to your account.')).toBeVisible()
 await page.getByRole('button',{name:'Check schedule',exact:true}).click()
 await expect(page.getByText('Timing conflicts found')).toBeVisible()
 await expect(page.getByText('Morning visit overlaps Lunch stop.')).toBeVisible()
 await expect(page.getByRole('button',{name:'Calculate directions',exact:true})).toBeDisabled()
 await request.delete(`/api/v1/trips/${id}`,{headers})
})


test('weather-map pin directions work when weather fails',async({page,request})=>{
 const {id,headers}=await createTrip(page,request)
 await page.route('**/api/v1/weather/**',route=>route.fulfill({status:503,json:{detail:'Test-only weather outage'}}))
 const destination=(await(await request.get('/api/v1/destinations/search')).json()).data[0]
 await page.goto('/app/weather-map')
 await page.getByRole('button',{name:'Find a destination',exact:true}).click()
 await page.getByRole('combobox',{name:'Filter destinations'}).fill(destination.name)
 await page.getByRole('option').filter({hasText:destination.name}).first().click()
 const link=page.getByRole('link',{name:'Directions to this pin'})
 await expect(link).toBeVisible()
 const url=new URL((await link.getAttribute('href'))!)
 const [lat,lon]=url.searchParams.get('destination')!.split(',').map(Number)
 expect(lat).toBe(destination.latitude);expect(lon).toBe(destination.longitude)
 await expect(page.getByText('Weather is unavailable.',{exact:false})).toBeVisible({timeout:15000})
 await expect(link).toHaveAttribute('target','_blank')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await request.delete(`/api/v1/trips/${id}`,{headers})
})
