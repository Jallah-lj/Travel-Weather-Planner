import { test, expect } from '@playwright/test'
const addDays=(date:string,n:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}

test('plan, validate, save and edit a three-stop journey',async({page,request})=>{
 test.setTimeout(90000)
 const session=(await(await request.post('/api/v1/auth/register',{data:{email:`journey-${Date.now()}@example.com`,password:'Journey-test-password42',display_name:'Journey tester'}})).json()).data
 const headers={Authorization:`Bearer ${session.access_token}`}
 const names=['Kigali','Nairobi','Mombasa'];const places=[]
 for(const name of names){const response=await request.get('/api/v1/destinations/search',{params:{q:name}});expect(response.status()).toBe(200);places.push((await response.json()).data.find((p:any)=>p.name===name))}
 await page.addInitScript(s=>sessionStorage.setItem('travel-weather-session',JSON.stringify({...s,expiresAt:Date.now()+600000})),session)
 await page.route('**/api/v1/destinations/search?*',route=>{const q=new URL(route.request().url()).searchParams.get('q')||'';return route.fulfill({json:{success:true,data:places.filter(p=>p.name.toLowerCase().includes(q.toLowerCase()))}})})
 const weatherRequests:string[]=[]
 await page.route('**/api/v1/weather/**',route=>{weatherRequests.push(route.request().url());return route.fulfill({json:{success:true,data:route.request().url().includes('/forecast')?[]:{temperature:23,feels_like:23,condition:'Test only',icon:'sun',humidity:60,wind:12,precipitation:10},meta:{provider:'test-only'}}})})
 await page.goto('/planner');await page.getByRole('button',{name:'Continue',exact:true}).click()
 const start=await page.getByLabel('Stop 1 arrival').inputValue()
 for(let i=0;i<3;i++){
  if(i)await page.getByRole('button',{name:'Add another stop'}).click()
  const region=page.getByRole('region',{name:`Stop ${i+1}`,exact:true})
  await region.getByRole('combobox',{name:'Search worldwide'}).fill(names[i])
  await page.getByRole('option',{name:new RegExp(names[i])}).first().click()
  await page.getByLabel(`Stop ${i+1} arrival`).fill(addDays(start,i))
  await page.getByLabel(`Stop ${i+1} last day`).fill(addDays(start,i))
 }
 await page.getByLabel('Trip name').fill('East Africa journey')
 await page.getByLabel('Stop 2 arrival').fill(start)
 await page.getByRole('button',{name:'Continue',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('overlaps')
 await page.getByLabel('Stop 2 arrival').fill(addDays(start,1))
 await page.getByRole('button',{name:'Continue',exact:true}).click()
 await page.getByRole('button',{name:'Choose a day',exact:true}).click()
 await page.getByRole('option',{name:/Day 2/}).click()
 await page.getByRole('button',{name:'Add activity',exact:true}).click()
 await page.getByLabel('Draft activity 1 title').fill('Nairobi museum visit')
 await page.getByRole('button',{name:'Review my trip'}).click()
 await page.getByRole('button',{name:'Create my trip'}).click()
 await expect(page).toHaveURL(/\/trip\//)
 const id=page.url().split('/').pop()
 await expect(page.getByRole('heading',{name:/East Africa journey/})).toBeVisible()
 await page.getByRole('region',{name:'Journey stops'}).getByRole('button').nth(1).click()
 await expect(page.getByLabel('Activity 1 title')).toHaveValue('Nairobi museum visit')
 await expect(page.locator('#weather')).toContainText('Nairobi')
 await expect.poll(()=>weatherRequests.some(url=>url.includes('latitude='+places[1].latitude)&&url.includes('start_date='+addDays(start,1)))).toBe(true)
 await page.getByRole('button',{name:'Manage stops'}).click()
 await page.getByLabel('Stop 3 last day').fill(addDays(start,3))
 page.once('dialog',dialog=>dialog.accept())
 await page.getByRole('button',{name:'Save stops',exact:true}).click()
 await expect(page.getByText('Stops saved. Review your activities and local times.')).toBeVisible()
 await page.reload()
 const data=(await(await request.get(`/api/v1/trips/${id}/plan`,{headers})).json()).data
 expect(data.stops.map((s:any)=>s.destination.name)).toEqual(names)
 expect(data.return_date).toBe(addDays(start,3))
 expect(data.itinerary).toHaveLength(4)
 expect(data.itinerary[1].items[0].title).toBe('Nairobi museum visit')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await request.delete(`/api/v1/trips/${id}`,{headers})
})
