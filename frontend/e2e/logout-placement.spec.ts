import { test, expect } from '@playwright/test'
for (const width of [390, 820, 1366]) {
  test(`logout lives in account navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      // A client session fixture for layout testing; no private API is accessed.
      if (!sessionStorage.getItem('fixture-initialized')) {
        sessionStorage.setItem('fixture-initialized', '1')
        sessionStorage.setItem('travel-weather-session', JSON.stringify({ user: { email: 'layout@example.com', display_name: 'Layout Tester' }, access_token: 'test-only', expiresAt: Date.now() + 600000 }))
      }
    })
    await page.goto('/app/explore')
    await expect(page.locator('header').getByRole('button', { name: 'Log out', exact: true })).toHaveCount(0)
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open navigation menu' }).click()
      await expect(page.getByRole('dialog').getByText('layout@example.com')).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click()
    } else {
      await page.locator('.workspace-sidebar').getByRole('button', { name: 'Log out', exact: true }).click()
    }
    await expect(page).toHaveURL(/\/login$/)
    expect(await page.evaluate(() => sessionStorage.getItem('travel-weather-session'))).toBeNull()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login$/)
  })
}
