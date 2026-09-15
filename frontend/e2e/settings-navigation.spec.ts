import { test, expect } from '@playwright/test'
for (const width of [390,820,1366]) {
  test(`settings categories open dedicated pages at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900})
    await page.addInitScript(()=>sessionStorage.setItem('travel-weather-session',JSON.stringify({user:{email:'settings@example.com'},access_token:'test-only',expiresAt:Date.now()+600000})))
    const sections=[['language','Language & region'],['profile','Profile'],['preferences','Travel preferences'],['notifications','Notifications'],['privacy','Privacy & security']]
    await page.goto('/app/settings')
    for(const [path,label] of sections){
      await page.getByRole('navigation',{name:'Settings categories'}).getByRole('link',{name:new RegExp(label.replace('&','&'))}).click()
      await expect(page).toHaveURL(new RegExp(`/app/settings/${path}$`))
      const heading=page.getByRole('heading',{name:label,exact:true,level:1})
      await expect(heading).toBeVisible()
      await expect(heading).toBeFocused()
      expect((await heading.boundingBox())!.y).toBeLessThan(300)
      if(width<768)await expect(page.getByRole('navigation',{name:'Settings categories'})).not.toBeVisible()
      await page.reload()
      await expect(heading).toBeVisible()
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await page.getByRole('link',{name:'Back to Settings',exact:true}).click()
      await expect(page).toHaveURL(/\/app\/settings$/)
      await expect(page.getByRole('heading',{name:'Settings',exact:true,level:1})).toBeVisible()
    }
    await page.goto('/app/settings?section=language')
    await expect(page).toHaveURL(/\/app\/settings\/language$/)
    await page.goto('/app/settings/unknown')
    await expect(page).toHaveURL(/\/app\/settings$/)
  })
}
