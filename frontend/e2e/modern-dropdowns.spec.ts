import { test, expect } from '@playwright/test'
for (const [width,height] of [[320,900],[390,900],[768,900],[1366,900],[844,390]]) {
 test(`dropdowns at ${width}×${height}`,async({page,request})=>{
  test.setTimeout(60000);await page.setViewportSize({width,height})
  const account=(await(await request.post('/api/v1/auth/register',{data:{email:`dropdown-${width}-${Date.now()}@example.com`,password:'Dropdown-test-passphrase42',display_name:'Dropdown Test'}})).json()).data
  const headers={Authorization:`Bearer ${account.access_token}`}
  const places=(await(await request.get('/api/v1/destinations/search')).json()).data
  const trip=(await(await request.post('/api/v1/trips',{headers,data:{destination_id:places[0].id,departure_date:'2026-09-15',return_date:'2026-09-17'}})).json()).data
  await page.addInitScript(s=>{sessionStorage.setItem('travel-weather-session',JSON.stringify({...s,expiresAt:Date.now()+600000}));localStorage.setItem('travel-weather:theme','dark')},account)
  await page.route('**/api/v1/weather/**',route=>route.fulfill({json:{success:true,data:{temperature:24,feels_like:24,condition:'Test',icon:'sun',humidity:60,wind:8,precipitation:20,uv:3,visibility:10},meta:{provider:'test-only'}}}))
  async function bounds(){const panel=page.locator('.modern-select-panel');await expect(panel).toBeVisible();const box=await panel.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(height+1)}
  await page.goto('/app/settings?section=language')
  await page.getByRole('button',{name:'AI response language',exact:true}).click();await bounds()
  await page.getByRole('combobox',{name:'Find an AI response language'}).fill('francais')
  await page.getByRole('option',{name:/French/}).click()
  await expect(page.getByRole('button',{name:'AI response language',exact:true})).toContainText('French')
  await expect(page.getByRole('button',{name:'AI response language',exact:true})).toBeFocused()
  await page.getByRole('button',{name:'Regional format',exact:true}).click();await bounds()
  await page.getByRole('combobox',{name:'Search regional format'}).fill('no match whatsoever')
  await expect(page.getByText('No matches found')).toBeVisible()
  await page.getByRole('button',{name:'Clear search',exact:true}).click();await page.keyboard.press('Escape')
  await expect(page.getByRole('button',{name:'Regional format',exact:true})).toBeFocused()
  await page.getByRole('button',{name:'Save language preferences'}).click();await page.reload()
  await expect(page.getByRole('button',{name:'AI response language',exact:true})).toContainText('French')
  await page.goto(`/trip/${trip.id}`)
  await page.getByRole('button',{name:'Trip day',exact:true}).click();await bounds()
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter')
  await expect(page.getByRole('button',{name:'Trip day',exact:true})).toContainText('2026-09-16')
  await page.getByRole('button',{name:'Manage sharing'}).click()
  await page.getByRole('button',{name:'Permission',exact:true}).click();await bounds()
  await page.getByRole('option',{name:/Can edit plan/}).click()
  await expect(page.getByRole('button',{name:'Permission',exact:true})).toContainText('Can edit plan')
  await page.getByRole('button',{name:'Expires after',exact:true}).click()
  await page.getByRole('option',{name:'30 days',exact:true}).click()
  await expect(page.getByRole('button',{name:'Expires after',exact:true})).toContainText('30 days')
  await page.goto('/app/trips');await page.getByRole('button',{name:'Trip options',exact:true}).first().click()
  await expect(page.getByRole('menuitem',{name:'Open trip'})).toBeVisible();await page.keyboard.press('Escape')
  await page.goto('/app/compare');await page.getByRole('button',{name:'Destination 1',exact:true}).click();await bounds();await page.keyboard.press('Escape')
  await page.goto('/app/weather-map');const map=page.getByRole('region',{name:'Interactive geographic map'});const before=await map.boundingBox()
  await page.getByRole('button',{name:'Find a destination',exact:true}).click();await bounds();await page.keyboard.press('Escape')
  const after=await map.boundingBox();expect(after!.height).toBe(before!.height);expect(after!.width).toBe(before!.width)
  await page.getByRole('button',{name:'Switch to light mode'}).click()
  await page.getByRole('combobox',{name:'Search worldwide'}).fill('Kigali')
  await expect(page.getByRole('option',{name:/Kigali/}).first()).toBeVisible({timeout:20000});await bounds()
  await page.getByRole('option',{name:/Kigali/}).first().click()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await request.delete(`/api/v1/trips/${trip.id}`,{headers})
 })
}
