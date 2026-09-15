import { test, expect } from '@playwright/test'

test('private trip edits survive reload and cannot be accessed by another account', async ({ page, request }) => {
  test.setTimeout(60000)
  async function account(label: string) {
    const response = await request.post('/api/v1/auth/register', { data: { email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, password: 'Private-trip-password42', display_name: 'Private Traveler' } })
    expect(response.status()).toBe(201)
    return (await response.json()).data
  }
  const a = await account('owner'); const b = await account('other')
  const headers = { Authorization: `Bearer ${a.access_token}` }
  const locations = (await (await request.get('/api/v1/destinations/search')).json()).data
  const departure = new Date().toISOString().slice(0, 10)
  const response = await request.post('/api/v1/trips', { headers, data: { destination_id: locations[0].id, departure_date: departure, return_date: departure, activities: ['walking'] } })
  expect(response.status()).toBe(201)
  const id = (await response.json()).data.id
  await page.addInitScript(session => sessionStorage.setItem('travel-weather-session', JSON.stringify(session)), { ...a, expiresAt: Date.now() + a.expires_in * 1000 })
  await page.goto(`/trip/${id}`)
  await expect(page.getByRole('heading', { name: 'Your itinerary' })).toBeVisible()
  await page.getByRole('button', { name: 'Add activity', exact: true }).click()
  await page.getByLabel('Activity 1 title').fill('Visit the local museum')
  await page.getByLabel('Activity 1 time').fill('10:30')
  await page.getByRole('checkbox', { name: 'Packed Travel documents' }).check()
  await page.getByLabel('Quantity for Phone charger').fill('2')
  await page.getByRole('button', { name: 'Add packing item', exact: true }).click()
  await page.getByLabel('Packing item 4 name').fill('Reusable water bottle')
  await page.getByRole('button', { name: 'Save all changes' }).first().click()
  await expect(page.getByText('All changes saved to your account.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Activity 1 title')).toHaveValue('Visit the local museum')
  await expect(page.getByLabel('Activity 1 time')).toHaveValue('10:30')
  await expect(page.getByRole('checkbox', { name: 'Packed Travel documents' })).toBeChecked()
  await expect(page.getByLabel('Quantity for Phone charger')).toHaveValue('2')
  await expect(page.getByLabel('Packing item 4 name')).toHaveValue('Reusable water bottle')
  const foreign = { Authorization: `Bearer ${b.access_token}` }
  expect((await request.get(`/api/v1/trips/${id}/plan`, { headers: foreign })).status()).toBe(404)
  expect((await (await request.get('/api/v1/trips', { headers: foreign })).json()).data).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  // A weather outage does not prevent editing or saving the private plan.
  await page.route('**/api/v1/weather/**', route => route.fulfill({ status: 503, json: { success: false, error: { message: 'Weather outage' } } }))
  await page.reload()
  await page.getByLabel('Activity 1 title').fill('Indoor museum visit')
  await page.getByRole('button', { name: 'Save all changes' }).first().click()
  await expect(page.getByText('All changes saved to your account.')).toBeVisible()
  expect((await request.delete(`/api/v1/trips/${id}`, { headers })).status()).toBe(200)
})
