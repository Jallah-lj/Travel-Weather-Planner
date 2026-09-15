import { ThemeToggle } from '../features/theme/ThemeToggle'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, MapPin, CloudSun } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Logo } from '../components/brand/Logo'
import { Button } from '../components/ui/Button'
import { api } from '../services/api'
import { getSession, saveSession, usesSupabase } from '../features/auth/session'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const register = mode === 'register'
  const navigate = useNavigate(); const location = useLocation(); const queryClient = useQueryClient()
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState('')
  const [notice,setNotice]=useState('')
  const next = location.state?.from
  const destination = typeof next === 'string' && /^\/(app|planner|trip)(\/|$)/.test(next) ? next : '/app'
  useEffect(() => { document.title = `${register ? 'Create account' : 'Log in'} · Travel Weather` }, [register])
  if (getSession()) return <Navigate to={destination} replace state={location.state?.plannerState} />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; setError('')
    if (register && name.trim().length < 2) { setError('Please enter a name with at least 2 characters.'); return }
    if (register && password !== confirm) { setError('Your passwords do not match. Please try again.'); return }
    setPending(true)
    try {
      const result = register ? await api.register({ display_name: name.trim(), email: email.trim(), password }) : await api.login({ email: email.trim(), password })
      if(!result){setNotice('Check your email to confirm your account, then log in. Open the confirmation link in this browser.');setPending(false);return}
      saveSession(result); queryClient.clear(); navigate(destination, { replace: true, state: location.state?.plannerState })
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to connect. Please try again.'); setPending(false) }
  }
  return <main className="grid min-h-screen bg-cream text-ink lg:grid-cols-2">
    <aside className="relative hidden overflow-hidden bg-forest p-12 text-white lg:flex lg:flex-col xl:p-16">
      <img src="/kigali-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,28,20,.55),rgba(8,28,20,.85))]" />
      <div className="relative"><Logo light /></div>
      <div className="relative my-auto max-w-lg py-20"><span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-xs"><CloudSun size={16} /> A little foresight. A better journey.</span><h2 className="mt-8 text-5xl font-semibold leading-[1.08] tracking-[-.05em] xl:text-6xl">Good days<br />start with<br /><span className="font-light italic text-[#f3d39d]">a better plan.</span></h2><p className="mt-6 max-w-sm leading-7 text-white/80">Make room for the experiences you love, with the weather in mind.</p><ul className="mt-9 space-y-4 text-sm text-white/85">{['Weather-aware itineraries', 'Packing lists made for your plans', 'The right hours for your favorite activities'].map(text => <li key={text} className="flex items-center gap-3"><Check size={16} className="text-amber" />{text}</li>)}</ul></div>
      <div className="relative flex items-center justify-between gap-5 border-t border-white/20 pt-6 text-xs text-white/70"><span className="flex items-center gap-2"><MapPin size={14} /> Kigali, Rwanda</span><span>Weather guidance, never guarantees.</span></div>
    </aside>
    <section className="flex flex-col px-6 py-8 sm:px-12 lg:px-14 xl:px-24">
      <div className="mb-10 lg:hidden"><Logo /></div><div className="flex items-center justify-between gap-4"><Link to="/" className="flex w-fit items-center gap-2 text-sm text-slate hover:text-forest"><ArrowLeft size={16} />Back to home</Link><ThemeToggle /></div>
      <div className="mx-auto my-auto w-full max-w-md py-12">
        <p className="eyebrow">{register ? 'Your next chapter' : 'Your travel desk awaits'}</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.04em]">{register ? 'Create your account' : 'Welcome back.'}</h1><p className="mt-3 text-sm leading-6 text-slate">{register ? 'Start planning more thoughtful, weather-aware journeys.' : 'Log in to continue planning your next good day.'}</p>
        <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={pending}>
          <fieldset disabled={pending} className="space-y-5">
            {register && <div><label htmlFor="display-name" className="form-label">Full name</label><input id="display-name" name="name" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className="form-input" /></div>}
            <div><label htmlFor="email" className="form-label">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="form-input" /></div>
            <div><label htmlFor="password" className="form-label">Password</label><div className="relative"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 10 : undefined} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="form-input pr-12" aria-describedby={register ? 'password-hint' : undefined} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-lg text-slate focus-visible:outline-forest">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{register && <p id="password-hint" className="mt-2 text-xs text-slate">Use 10–128 characters. A unique passphrase works well.</p>}</div>
            {register && <div><label htmlFor="confirm-password" className="form-label">Confirm password</label><input id="confirm-password" name="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} className="form-input" /></div>}
          </fieldset>
          {notice&&<p role="status" className="rounded-xl bg-forest/5 p-4 text-sm text-forest">{notice}</p>}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          <Button type="submit" size="lg" disabled={pending} className="w-full"><span aria-live="polite">{pending ? (register ? 'Creating your account…' : 'Logging in…') : (register ? 'Create account' : 'Log in')}</span>{!pending && <ArrowRight size={18} />}</Button>
        </form>
        {!register&&usesSupabase&&<Link to="/forgot-password" className="mt-5 inline-block text-sm font-semibold text-forest underline">Forgot password?</Link>}
        <p className="mt-7 text-center text-sm text-slate">{register ? 'Already have an account?' : 'New to Travel Weather?'}{' '}<Link to={register ? '/login' : '/register'} state={location.state} className="font-semibold text-forest underline underline-offset-4">{register ? 'Log in' : 'Create an account'}</Link></p>
        <div className="mt-9 border-t border-black/10 pt-5 text-xs leading-5 text-slate">Your trips and saved plans are private to your account. Live weather is supplied by Open-Meteo; forecasts are guidance, not guarantees.</div>
      </div>
      <p className="text-center text-xs text-slate">A calmer way to travel.</p>
    </section>
  </main>
}
