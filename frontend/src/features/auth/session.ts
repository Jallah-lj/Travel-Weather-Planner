import { createClient, type Session as SupabaseSession } from '@supabase/supabase-js'
export type AuthResponse = { user: { id: string; email: string; display_name?: string }; access_token: string; expires_in: number }
type Session = AuthResponse & { expiresAt: number }
const key = 'travel-weather-session'
export const usesSupabase = import.meta.env.VITE_AUTH_PROVIDER === 'supabase'
// Share only the PKCE verifier across tabs so ordinary email links work in this browser.
// Access/refresh credentials remain tab-scoped, not in localStorage.
const authStorage = {
  getItem:(key:string)=>(key.endsWith('-code-verifier')?localStorage:sessionStorage).getItem(key),
  setItem:(key:string,value:string)=>(key.endsWith('-code-verifier')?localStorage:sessionStorage).setItem(key,value),
  removeItem:(key:string)=>(key.endsWith('-code-verifier')?localStorage:sessionStorage).removeItem(key),
}
export const supabase = usesSupabase ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType:'pkce', storage:authStorage, storageKey:'travel-weather-supabase', autoRefreshToken:true, persistSession:true, detectSessionInUrl:false },
}) : null
let current:Session|null=null
const notify=()=>window.dispatchEvent(new Event('travel-auth-change'))
function mirror(value:SupabaseSession|null) {
  current=value?.user.email ? {user:{id:value.user.id,email:value.user.email,display_name:typeof value.user.user_metadata.display_name==='string'?value.user.user_metadata.display_name.slice(0,120):'Traveler'},access_token:value.access_token,expires_in:value.expires_in,expiresAt:(value.expires_at||0)*1000}:null
  notify()
}
let initialization:Promise<void>|undefined
export function initializeAuth() {
  return initialization ||= (async()=>{
    if(!supabase)return
    sessionStorage.removeItem(key) // Never reuse legacy sessions in Supabase mode.
    supabase.auth.onAuthStateChange((_event,session)=>mirror(session))
    const {data,error}=await supabase.auth.getSession()
    if(error)throw new Error('Unable to restore your session. Please reload or log in again.')
    mirror(data.session)
  })()
}
export function getSession():Session|null {
  if(usesSupabase)return current&&current.expiresAt>Date.now()?current:null
  try {
    const value=JSON.parse(sessionStorage.getItem(key)||'null') as Session|null
    if(value&&value.expiresAt>Date.now()&&value.access_token&&value.user?.email)return value
    sessionStorage.removeItem(key)
  } catch { /* No browser storage means signed out. */ }
  return null
}
export async function getAccessSession() {
  if(supabase){const {data,error}=await supabase.auth.getSession();if(error)throw new Error('Session refresh failed. Please log in again.');mirrorWithoutNotify(data.session)}
  return getSession()
}
function mirrorWithoutNotify(value:SupabaseSession|null){
  if(value?.access_token!==current?.access_token)mirror(value)
}
export function saveSession(value:AuthResponse) {
  if(usesSupabase)return // SDK manages access and refresh rotation.
  sessionStorage.setItem(key,JSON.stringify({...value,expiresAt:Date.now()+value.expires_in*1000}))
  notify()
}
export async function clearSession() {
  if(supabase){const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw new Error('Could not sign out securely. Please retry.')}
  current=null;sessionStorage.removeItem(key);notify()
}
export async function supabaseLogin(email:string,password:string):Promise<AuthResponse> {
  const {data,error}=await supabase!.auth.signInWithPassword({email,password})
  if(error)throw error
  mirror(data.session)
  if(!current)throw new Error('No session was created. Confirm your email first.')
  return current
}
export async function supabaseRegister(email:string,password:string,display_name:string):Promise<AuthResponse|null> {
  const {data,error}=await supabase!.auth.signUp({email,password,options:{data:{display_name},emailRedirectTo:`${location.origin}/auth/callback`}})
  if(error)throw error
  mirror(data.session)
  return current
}
let callback:Promise<string>|undefined
export function completeAuthRedirect():Promise<string> {
  return callback ||= (async()=>{
    if(!supabase)throw new Error('Supabase authentication is not configured.')
    const params=new URLSearchParams(location.search)
    const code=params.get('code'),hash=params.get('token_hash'),type=params.get('type')
    const recovery=type==='recovery'||params.get('flow')==='recovery'
    const failed=params.has('error')||params.has('error_description')
    history.replaceState(null,'','/auth/callback')
    if(failed)throw new Error('This link is invalid or expired. Request a new email link.')
    if(code){const {data,error}=await supabase.auth.exchangeCodeForSession(code);if(error)throw error;mirror(data.session)}
    else if(hash&&(type==='email'||type==='signup'||type==='recovery')){
      const {data,error}=await supabase.auth.verifyOtp({token_hash:hash,type});if(error)throw error;mirror(data.session)
    }else throw new Error('This link is incomplete. Open the latest confirmation or reset email.')
    if(!current)throw new Error('No session was created. Request a new email link.')
    return recovery?'/reset-password':'/app'
  })()
}
