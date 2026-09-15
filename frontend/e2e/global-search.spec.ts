import { test, expect } from '@playwright/test'
test('worldwide result can be selected using the keyboard', async ({ page }) => {
  await page.goto('/')
  const search = page.getByRole('combobox', { name: 'Search worldwide' })
  await search.fill('Accra')
  await expect(page.getByRole('option').filter({ hasText: 'Ghana' }).first()).toBeVisible({ timeout: 20000 })
  await search.press('ArrowDown')
  await search.press('Enter')
  await expect(search).toHaveValue('Accra')
  await expect(page.getByRole('button', { name: 'Plan my trip' })).toBeEnabled()
})
