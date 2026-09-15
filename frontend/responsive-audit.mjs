import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const results=[]
for (const width of [320,390,768,1024,1366,1920]) {
 const page=await browser.newPage({viewport:{width,height:width<500?844:900}})
 await page.addInitScript(()=>{if(!['/','/login','/register'].includes(location.pathname))sessionStorage.setItem('travel-weather-session',JSON.stringify({user:{email:'layout@example.com'},access_token:'test',expiresAt:Date.now()+600000}));else sessionStorage.removeItem('travel-weather-session')})
 for(const path of ['/','/login','/register','/app','/planner','/app/trips','/app/explore','/app/saved','/app/compare','/app/weather-map','/app/notifications','/app/settings','/trip/demo']) {
  await page.goto('http://127.0.0.1:5173'+path)
  await page.locator('h1').first().waitFor({timeout:15000}).catch(()=>{})
  const report=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,offenders:[...document.querySelectorAll('main *,header *,nav *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left< -2)&&getComputedStyle(e).position!=='absolute'&&!e.closest('.maplibregl-map')}).slice(0,6).map(e=>({tag:e.tagName,text:e.textContent?.slice(0,60),class:e.className}))}))
  results.push({width,path,...report})
 }
 await page.close()
}
await browser.close()
const fs=await import('node:fs/promises');await fs.writeFile('/home/user/responsive-audit.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.filter(r=>r.overflow>0),null,2));console.log('Audited',results.length,'layouts')
