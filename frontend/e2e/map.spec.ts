import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page, request }) => {
  const response = await request.post('/api/v1/auth/register', { data: { display_name: 'Map Tester', email: `map-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, password: 'Map-test-password-42' } })
  const { data } = await response.json()
  await page.addInitScript(session => sessionStorage.setItem('travel-weather-session', JSON.stringify(session)), { ...data, expiresAt: Date.now() + data.expires_in * 1000 })
})
test('vector map works without referrer and never requests blocked OSM tiles', async ({ page }) => {
  const blockedRequests: string[] = []
  page.on('request', request => { if (request.url().includes('tile.openstreetmap.org')) blockedRequests.push(request.url()) })
  await page.route('https://tiles.openfreemap.org/**', route => {
    const headers = { ...route.request().headers() }; delete headers.referer
    return route.continue({ headers })
  })
  await page.goto('/app/weather-map')
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
  await expect(page.getByText('Loading geographic map…')).toHaveCount(0, { timeout: 25000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap')
  await page.getByRole('button', { name: 'Find a destination', exact: true }).click()
  await page.getByRole('combobox', { name: 'Filter destinations' }).fill('Kigali')
  await page.getByRole('option', { name: /Kigali/ }).first().click()
  await expect(page.locator('.destination-pin.is-selected')).toHaveCount(1)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.screenshot({ path: `/home/user/map-fixed-${test.info().project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Reset to world view' }).click()
  expect(blockedRequests).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: 'Plan a trip here' }).click()
  await expect(page).toHaveURL(/\/planner$/)
})
test('provider failure shows an actionable error', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', route => route.abort())
  await page.goto('/app/weather-map')
  await expect(page.getByRole('alert')).toContainText('Map data could not load')
  await expect(page.getByRole('button', { name: 'Retry map' })).toBeVisible()
})
