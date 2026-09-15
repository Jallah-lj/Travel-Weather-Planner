import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, request }) => {
  const response = await request.post('/api/v1/auth/register', { data: { display_name: 'Jallah', email: `planner-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, password: 'Test-weather-passphrase-42' } })
  const { data } = await response.json()
  await page.addInitScript(session => sessionStorage.setItem('travel-weather-session', JSON.stringify(session)), { ...data, expiresAt: Date.now() + data.expires_in * 1000 })
})

test('traveler creates a weather-aware Kigali trip', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /plan your trip/i })).toBeVisible()
  const destination = page.getByPlaceholder('Where are you going?')
  await destination.fill('Kigali')
  await page.getByRole('option', { name: /Kigali/ }).first().click()
  await page.getByRole('button', { name: /plan my trip/i }).click()
  await expect(page.getByRole('heading', { name: 'How would you like to plan?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Review my trip' }).click()
  await page.getByRole('button', { name: 'Create my trip' }).click()
  await expect(page).toHaveURL(/\/trip\//, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Kigali/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Live destination weather' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Packing list' })).toBeVisible()
})

test('workspace navigation connects every planning area', async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: /Welcome, Jallah/ })).toBeVisible()

  await page.locator('a:visible').filter({ hasText: 'Trips' }).first().click()
  await expect(page).toHaveURL(/\/app\/trips/)
  await expect(page.getByRole('heading', { name: 'Trips', exact: true })).toBeVisible()

  await page.locator('a:visible').filter({ hasText: 'Explore' }).first().click()
  await expect(page).toHaveURL(/\/app\/explore/)
  await page.getByRole('link', { name: /Saved/ }).click()
  await expect(page.getByRole('heading', { name: 'Saved destinations', exact: true })).toBeVisible()

  await page.getByRole('link', { name: /Explore more/ }).click()
  await page.getByRole('link', { name: 'Compare', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Compare destinations' })).toBeVisible()

  await page.getByRole('link', { name: /Back to explore/ }).click()
  await page.getByRole('link', { name: /Open map/ }).click()
  await expect(page.getByRole('heading', { name: 'Weather map' })).toBeVisible()

  const width = page.viewportSize()?.width || 1200
  if (width < 1024) await page.getByRole('link', { name: 'Profile' }).click()
  else await page.locator('a:visible').filter({ hasText: 'Settings' }).first().click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})
