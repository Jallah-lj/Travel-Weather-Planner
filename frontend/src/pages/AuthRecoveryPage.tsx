import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { completeAuthRedirect, getSession, supabase, clearSession } from '../features/auth/session'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { Logo } from '../components/brand/Logo'
export function AuthRecoveryPage({mode}:{mode:'callback'|'request'|'reset'}) {
 const navigate=useNavigate()
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('')
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{
  if(mode!=='callback')return
  let active=true
  completeAuthRedirect().then(path=>{if(active)navigate(path,{replace:true})}).catch(()=>{if(active)setError('This link is invalid, expired, or was opened in a different browser. Request a new email and open it in the browser where you started.')})
  return()=>{active=false}
 },[mode,navigate])
 async function submit(event:FormEvent){
  event.preventDefault();if(!supabase||busy)return;setError('');setNotice('');setBusy(true)
  try{
   if(mode==='request'){
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${location.origin}/auth/callback?flow=recovery`})
    if(error)throw error
    setNotice('If an account exists, a password-reset email will arrive shortly. Open it in this browser.')
   }else{
    if(!getSession())throw new Error('Open a valid password-reset link first.')
    if(password!==confirm)throw new Error('Passwords do not match.')
    const {error}=await supabase.auth.updateUser({password});if(error)throw error
    await clearSession();navigate('/login',{replace:true})
   }
  }catch(error){setError(error instanceof Error?error.message:'Please try again.')}finally{setBusy(false)}
 }
 return <main className="min-h-screen bg-cream p-6 sm:p-12"><Logo/><section className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-6 shadow-card sm:p-8"><h1 className="text-3xl font-semibold">{mode==='callback'?'Confirming your email':mode==='request'?'Reset your password':'Choose a new password'}</h1>
 {!supabase?<p className="mt-4">Supabase authentication is not enabled in this environment.</p>:mode==='callback'?!error&&<Skeleton className="mt-6 h-24 w-full rounded-xl"/>:<form onSubmit={submit} className="mt-6 space-y-5"><fieldset disabled={busy} className="space-y-5">{mode==='request'?<label className="block"><span className="form-label">Email address</span><input type="email" autoComplete="email" className="form-input" required value={email} onChange={e=>setEmail(e.target.value)}/></label>:<><label className="block"><span className="form-label">New password</span><input type="password" autoComplete="new-password" className="form-input" minLength={10} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="block"><span className="form-label">Confirm password</span><input type="password" autoComplete="new-password" className="form-input" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></>}<Button className="w-full" type="submit">{busy?'Please wait…':mode==='request'?'Send reset email':'Save new password'}</Button></fieldset></form>}
 {notice&&<p role="status" className="mt-5 text-sm text-forest">{notice}</p>}{error&&<p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}<div className="mt-6 flex flex-wrap gap-5 text-sm text-forest underline"><Link to="/login">Back to log in</Link>{mode!=='request'&&<Link to="/forgot-password">Request a new reset link</Link>}</div></section></main>
}
