import { writeFileSync } from 'node:fs'
function origin(name){
 const value=process.env[name]; if(!value)throw Error(`Set ${name} first`)
 const url=new URL(value); if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error(`${name} must be an HTTPS origin`)
 return url.origin
}
const api=origin('VITE_API_BASE_URL'),supabase=origin('VITE_SUPABASE_URL')
const policy=`default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' ${api} ${supabase} https://tiles.openfreemap.org https://*.googleapis.com https://*.gstatic.com; worker-src 'self' blob:; frame-src https://www.google.com; upgrade-insecure-requests`
const config={
 $schema:'https://openapi.vercel.sh/vercel.json',framework:'vite',installCommand:'npm ci',buildCommand:'npm run build',outputDirectory:'dist',
 rewrites:[{source:'/(.*)',destination:'/index.html'}],
 headers:[{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:policy},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'Permissions-Policy',value:'camera=(), microphone=()'},{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}]},
 {source:'/auth/(.*)',headers:[{key:'Cache-Control',value:'no-store'},{key:'Referrer-Policy',value:'no-referrer'}]},
 {source:'/share',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}]}]
}
writeFileSync('vercel.json',JSON.stringify(config,null,2)+'\n')
console.log('Wrote vercel.json with exact public API and Supabase CSP origins. Commit this file; no keys were written.')
