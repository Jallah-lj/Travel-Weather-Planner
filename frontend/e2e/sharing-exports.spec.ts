import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

test('share permissions, revocation, exports and fully offline snapshot', async ({ page, request, browser }, testInfo) => {
  test.setTimeout(90000)
  const registration = await request.post('/api/v1/auth/register', { data: { email: `share-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, password: 'Phase-one-password42', display_name: 'Travel Tester' } })
  expect(registration.status()).toBe(201)
  const session = (await registration.json()).data
  const headers = { Authorization: `Bearer ${session.access_token}` }
  const places = (await (await request.get('/api/v1/destinations/search')).json()).data
  const created = await request.post('/api/v1/trips', { headers, data: { destination_id: places[0].id, departure_date: '2026-09-14', return_date: '2026-09-15' } })
  expect(created.status()).toBe(201)
  const id = (await created.json()).data.id
  const plan = (await (await request.get(`/api/v1/trips/${id}/plan`, { headers })).json()).data
  plan.itinerary[0].items = [{ id:'museum', time:'10:30', title:'Museum visit', category:'indoor' }]
  expect((await request.put(`/api/v1/trips/${id}/plan`, { headers, data: plan })).status()).toBe(200)
  await page.addInitScript(s => sessionStorage.setItem('travel-weather-session', JSON.stringify(s)), { ...session, expiresAt: Date.now() + session.expires_in * 1000 })
  await page.goto(`/trip/${id}`)
  await page.getByRole('button', { name: 'Manage sharing' }).click()
  await page.getByRole('button', { name: 'Create link', exact: true }).click()
  const newLink = page.getByLabel('New private link — copy before leaving')
  await expect(newLink).toBeVisible()
  const viewUrl = await newLink.inputValue()
  const guestContext = await browser.newContext({ viewport: page.viewportSize()! })
  const guest = await guestContext.newPage()
  const outgoing: string[] = []
  guest.on('request', r => outgoing.push(r.url()))
  await guest.goto(viewUrl)
  await expect(guest.getByText('Museum visit', { exact:true })).toBeVisible()
  await expect(guest.getByRole('button', { name:'Save all changes' })).toHaveCount(0)
  await expect(guest.getByText('2026-09-15 · Tuesday')).toBeVisible()
  const token = new URLSearchParams(new URL(viewUrl).hash.slice(1)).get('token')!
  expect(outgoing.some(url => url.includes(token))).toBe(false)

  await page.getByRole('button', { name:'Permission', exact:true }).click()
  await page.getByRole('option', { name:/Can edit plan/ }).click()
  await page.getByRole('button', { name:'Create link', exact:true }).click()
  await expect(newLink).not.toHaveValue(viewUrl)
  const editUrl = await newLink.inputValue()
  await guest.goto(editUrl)
  await guest.getByLabel('Activity 1 title').fill('Museum and gallery visit')
  await guest.getByRole('button', { name:'Save all changes' }).first().click()
  await expect(guest.getByText('Changes saved to the shared trip.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Activity 1 title')).toHaveValue('Museum and gallery visit')

  for (const [label, extension] of [['Export calendar','ics'],['Export PDF','pdf'],['Download offline copy','html']]) {
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: label, exact:true }).click()
    const download = await downloadEvent
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`))
    const path = testInfo.outputPath(`trip.${extension}`)
    await download.saveAs(path)
    const data = await readFile(path)
    if (extension === 'ics') expect(data.toString()).toContain('BEGIN:VEVENT')
    if (extension === 'pdf') expect(data.subarray(0,5).toString()).toBe('%PDF-')
    if (extension === 'html') {
      const offline = await browser.newContext({ offline: true, viewport: page.viewportSize()! })
      const offlinePage = await offline.newPage()
      await offlinePage.goto(pathToFileURL(path).href)
      await expect(offlinePage.getByText('Museum and gallery visit')).toBeVisible()
      await expect(offlinePage.getByRole('heading', { name:'Packing checklist' })).toBeVisible()
      await expect(offlinePage.getByRole('checkbox')).toHaveCount(3)
      expect(await offlinePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await offline.close()
    }
  }
  await page.getByRole('button', { name:'Manage sharing' }).click()
  await page.getByRole('listitem').filter({ hasText:'Can edit plan' }).getByRole('button', { name:/Revoke link/ }).click()
  await guest.reload()
  await expect(guest.getByRole('heading', { name:'Cannot open this shared trip' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await guestContext.close()
  await request.delete(`/api/v1/trips/${id}`, { headers })
})
