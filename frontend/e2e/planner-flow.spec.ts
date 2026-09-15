import { test, expect } from '@playwright/test'

async function begin(page: any, request: any, mode: 'manual'|'ai') {
  const response = await request.post('/api/v1/auth/register', { data:{email:`plannerflow-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,password:'Planner-test-password42',display_name:'Planner Test'} })
  expect(response.status()).toBe(201)
  const session=(await response.json()).data
  await page.addInitScript((s:any)=>sessionStorage.setItem('travel-weather-session',JSON.stringify({...s,expiresAt:Date.now()+s.expires_in*1000})),session)
  await page.goto('/planner')
  await page.getByRole('radio',{name:mode==='manual'?'Plan manually':'Use AI assistance',exact:true}).check()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('combobox',{name:'Search worldwide'}).fill('Kigali')
  await page.getByRole('option',{name:/Kigali/}).first().click()
  return {Authorization:`Bearer ${session.access_token}`}
}

test('manual review saves the complete plan only after confirmation',async({page,request})=>{
  await page.route('**/api/v1/**', route => { const headers = {...route.request().headers()}; delete headers.authorization; return route.continue({headers}) })
  const headers=await begin(page,request,'manual')
  await page.getByLabel('Trip name').fill('My Kigali getaway')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Build it your way.'})).toBeVisible()
  await page.getByRole('button',{name:'Add activity',exact:true}).click()
  await page.getByLabel('Draft activity 1 title').fill('Visit an art gallery')
  await page.getByLabel('Draft activity 1 time').fill('11:00')
  await page.getByRole('button',{name:/Packing list/}).click()
  await page.getByLabel('Draft packing item 1',{exact:true}).fill('Passport and tickets')
  await page.getByRole('button',{name:'Review my trip'}).click()
  expect((await (await request.get('/api/v1/trips',{headers})).json()).data).toEqual([])
  await expect(page.getByText('Your manually created draft')).toBeVisible()
  await page.getByRole('button',{name:'Create my trip',exact:true}).click()
  await expect(page).toHaveURL(/\/trip\//)
  await expect(page.getByRole('heading',{name:/My Kigali getaway/})).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Activity 1 title')).toHaveValue('Visit an art gallery')
  await expect(page.getByLabel('Packing item 1 name')).toHaveValue('Passport and tickets')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await request.delete('/api/v1/trips/'+page.url().split('/').pop(),{headers})
})

test('unconfigured AI offers honest rule-based draft without auto-saving',async({page,request})=>{
  await page.route('**/api/v1/ai/planning-options',route=>route.fulfill({json:{success:true,data:{ai_available:false,max_assisted_days:14,provider:null}}}))
  const headers=await begin(page,request,'ai')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByText('AI assistance isn’t connected yet')).toBeVisible()
  await expect(page.getByRole('button',{name:'Generate AI draft'})).toBeDisabled()
  await page.getByRole('button',{name:'Use rule-based suggestions'}).click()
  await expect(page.getByText('Rule-based suggestions',{exact:true})).toBeVisible({timeout:30000})
  await expect(page.getByLabel('Draft activity 1 title')).toBeVisible()
  expect((await (await request.get('/api/v1/trips',{headers})).json()).data).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('AI draft UI requires consent and allows editing before create',async({page,request})=>{
  await page.route('**/api/v1/ai/planning-options',route=>route.fulfill({json:{success:true,data:{ai_available:true,max_assisted_days:14,provider:'Test model'}}}))
  await page.route('**/api/v1/ai/plan-draft',async route=>{
    const input=route.request().postDataJSON();expect(input.ai_consent).toBe(true)
    const itinerary=[];let date=new Date(input.departure_date+'T12:00:00Z');const end=new Date(input.return_date+'T12:00:00Z')
    while(date<=end){itinerary.push({date:date.toISOString().slice(0,10),label:'Test day',headline:'Draft',items:[{id:date.toISOString(),time:'09:30',title:'Test AI suggestion',category:'custom'}]});date.setUTCDate(date.getUTCDate()+1)}
    await route.fulfill({json:{success:true,data:{draft:{itinerary,packing:[]},source:'AI-generated draft',weather_source:'test-only',forecast_days:0,warnings:['Test model fixture, not a live AI response.']}}})
  })
  await begin(page,request,'ai')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('button',{name:'Generate AI draft'})).toBeDisabled()
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Generate AI draft'}).click()
  await expect(page.getByText('AI-generated draft',{exact:true})).toBeVisible()
  await page.getByLabel('Draft activity 1 title').fill('My edited suggestion')
  await expect(page.getByRole('button',{name:'Create my trip'})).toBeEnabled()
})
