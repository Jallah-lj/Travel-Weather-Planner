import { test, expect } from '@playwright/test'

for (const viewport of [{width:320,height:740},{width:390,height:844},{width:768,height:1024},{width:844,height:390},{width:1024,height:768},{width:1366,height:768},{width:1920,height:1080}]) {
  test(`responsive navigation and content at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize(viewport)
    await page.addInitScript(() => { sessionStorage.setItem('travel-weather-session', JSON.stringify({ user: { email: 'responsive@example.com' }, access_token: 'test-only', expiresAt: Date.now() + 600000 })); localStorage.setItem('travel-weather:theme', 'dark') })
    for (const path of ['/app', '/app/explore', '/app/saved', '/app/settings', '/trip/demo', '/app/weather-map']) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      if (path === '/trip/demo') await expect(page.getByText('Smart packing list')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} should not overflow at ${viewport.width}`).toBe(true)
      if (viewport.width < 1024) await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
      else await expect(page.getByRole('navigation', { name: 'Workspace navigation', exact: true })).toBeVisible()
    }
    const map = page.getByRole('region', { name: 'Interactive geographic map' })
    expect((await map.boundingBox())?.height).toBe(viewport.width < 640 ? 440 : 600)
    await page.getByRole('button', { name: /Find a destination/ }).click()
    await expect(page.getByRole('combobox', { name: 'Filter destinations' })).toBeVisible()
    const popup = await page.locator('.modern-select-panel').boundingBox()
    expect(popup!.x).toBeGreaterThanOrEqual(0)
    expect(popup!.x + popup!.width).toBeLessThanOrEqual(viewport.width + 1)
  })
}
