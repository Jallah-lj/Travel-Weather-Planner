import { readFileSync } from 'node:fs'
if(process.env.VERCEL==='1'){
 for(const name of Object.keys(process.env)){if(name.startsWith('VITE_')&&/(SECRET|PASSWORD|DATABASE|SERVICE_ROLE|AI_API_KEY|SERVER_KEY)/.test(name))throw Error(`Remove server-only variable ${name} from the frontend environment`)}
 for(const name of ['VITE_AUTH_PROVIDER','VITE_API_BASE_URL','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']){
  if(!process.env[name]||/REPLACE|YOUR_|PROJECT_REF/.test(process.env[name]))throw Error(`Configure ${name} in this Vercel project's build environment`)
 }
 if(process.env.VITE_AUTH_PROVIDER!=='supabase')throw Error('Production deployment requires Supabase Auth')
 const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 if(!key.startsWith('sb_publishable_')){
  let role;try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role}catch{}
  if(role!=='anon')throw Error('Use a Supabase publishable key (or legacy anon key), never a secret/service_role key')
 }
 const config=JSON.parse(readFileSync('vercel.json','utf8'))
 const csp=config.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value
 for(const name of ['VITE_API_BASE_URL','VITE_SUPABASE_URL']){
  const url=new URL(process.env[name]);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error(`${name} must be an HTTPS origin`)
  if(!csp.split(/[ ;]+/).includes(url.origin))throw Error(`Run npm run configure:vercel with ${name}, then commit vercel.json`)
 }
}
