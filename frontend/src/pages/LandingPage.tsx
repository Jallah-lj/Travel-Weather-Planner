import { defaultDeparture, defaultReturn } from '../lib/tripDates'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, Check, CloudRain, Compass, MapPinned, ShieldCheck, Sparkles, Umbrella, Wind } from 'lucide-react'
import { Logo } from '../components/brand/Logo'
import { Button } from '../components/ui/Button'
import { DestinationSearch } from '../features/destinations/DestinationSearch'
import type { Destination } from '../types'

const highlights = [
  { icon: Compass, title: 'Know your best hours', copy: 'We translate hourly forecasts into the right moments for every activity.' },
  { icon: Umbrella, title: 'Pack precisely', copy: 'A practical packing list shaped by the weather, your plans, and trip length.' },
  { icon: ShieldCheck, title: 'Stay ahead of changes', copy: 'Weather shifts are matched against your itinerary before they disrupt the day.' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [destination, setDestination] = useState<Destination | null>(null)
  const [departure, setDeparture] = useState(defaultDeparture)
  const [returnDate, setReturnDate] = useState(defaultReturn)
  const plan = () => navigate('/planner', { state: { destination, departure, returnDate } })
  return <main className="min-h-screen bg-cream text-ink">
    <section className="hero relative min-h-[760px] overflow-hidden bg-forest text-white">
      <div className="absolute inset-0 bg-[url('/kigali-hero.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,28,20,.9)_0%,rgba(8,28,20,.58)_49%,rgba(8,28,20,.12)_100%)]" />
      <div className="sun-halo absolute -right-20 -top-24 h-[420px] w-[420px] rounded-full bg-amber/20 blur-3xl" />
      <nav className="relative z-10 mx-auto flex max-w-[1400px] flex-wrap gap-5 items-center justify-between px-5 py-7 md:px-10 lg:px-16">
        <Logo light />
        <div className="hidden items-center gap-8 text-sm font-medium text-white/75 md:flex"><a href="#how" className="hover:text-white">How it works</a><a href="#intelligence" className="hover:text-white">Travel intelligence</a><a href="#destinations" className="hover:text-white">Explore</a></div>
        <div className="flex items-center gap-3"><ThemeToggle light /><Link to="/login" className="text-sm font-semibold text-white hover:underline">Log in</Link><Button variant="amber" size="sm" onClick={() => navigate('/register')}>Create account</Button></div>
      </nav>
      <div className="relative z-10 mx-auto flex max-w-[1400px] flex-col justify-center px-5 pb-12 pt-20 md:px-10 lg:px-16 lg:pt-28">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }} className="max-w-4xl">
          <div className="mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.24em] text-white/68"><span className="h-px w-10 bg-amber" />Weather-aware travel planning</div>
          <h1 className="max-w-[900px] text-[clamp(3.5rem,7.5vw,7.2rem)] font-semibold leading-[.88] tracking-[-.065em]">Plan your trip<br /><span className="font-light italic text-[#f3d39d]">around the weather.</span></h1>
          <p className="mt-8 max-w-xl text-lg font-light leading-8 text-white/78 md:text-xl">Know what the skies have planned—before you pack your bags. Better days, smarter itineraries, fewer surprises.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .6 }} className="mt-12 max-w-[1120px] rounded-2xl bg-[#f8f6ef] p-3 text-ink shadow-[0_24px_70px_rgba(0,0,0,.25)] md:p-4">
          <div className="grid items-end gap-3 md:grid-cols-[1.35fr_.8fr_.8fr_auto]">
            <DestinationSearch value={destination} onSelect={setDestination} />
            <label className="block"><span className="mb-2 block text-[11px] font-bold uppercase tracking-[.16em] text-slate">Departure</span><span className="flex h-14 items-center gap-3 rounded-xl border border-black/10 bg-white px-4"><CalendarDays size={18} className="text-forest" /><input type="date" value={departure} min={new Date().toISOString().slice(0,10)} onChange={e => setDeparture(e.target.value)} className="w-full bg-transparent text-sm font-medium outline-none" /></span></label>
            <label className="block"><span className="mb-2 block text-[11px] font-bold uppercase tracking-[.16em] text-slate">Return</span><span className="flex h-14 items-center gap-3 rounded-xl border border-black/10 bg-white px-4"><CalendarDays size={18} className="text-forest" /><input type="date" value={returnDate} min={departure} onChange={e => setReturnDate(e.target.value)} className="w-full bg-transparent text-sm font-medium outline-none" /></span></label>
            <Button size="lg" onClick={plan} className="md:mb-0" disabled={!destination}>Plan my trip <ArrowRight size={18} /></Button>
          </div>
        </motion.div>
        <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-2 text-xs text-white/60"><span className="flex items-center gap-2"><Check size={14} /> Activity-aware forecast</span><span className="flex items-center gap-2"><Check size={14} /> Intelligent packing</span><span className="flex items-center gap-2"><Check size={14} /> Create an account to get started</span></div>
      </div>
    </section>

    <section id="intelligence" className="mx-auto max-w-[1400px] px-5 py-24 md:px-10 lg:px-16 lg:py-32">
      <div className="grid gap-14 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <div><p className="eyebrow">Forecast, translated</p><h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-.04em] md:text-6xl">Not just weather.<br />Travel intelligence.</h2><p className="mt-6 max-w-md text-lg leading-8 text-slate">Raw forecasts tell you what may happen. Travel Weather tells you what to do about it.</p>
          <div className="mt-10 space-y-8">{highlights.map(({ icon: Icon, title, copy }) => <div key={title} className="flex gap-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-forest/15 bg-white text-forest"><Icon size={19} /></span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate">{copy}</p></div></div>)}</div>
        </div>
        <div className="relative overflow-hidden rounded-[28px] bg-[#173f30] p-5 text-white shadow-soft md:p-8">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-amber/15 blur-3xl" />
          <div className="relative flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-white/55">Illustrative example · Not live weather</p><h3 className="mt-3 text-3xl font-semibold">Excellent conditions</h3><p className="mt-2 text-sm text-white/65">Mostly sunny with a brief afternoon shower.</p></div><div className="flex items-start"><span className="text-6xl font-light tracking-[-.08em]">27</span><span className="mt-2 text-lg">°</span></div></div>
          <div className="relative mt-10 grid gap-4 sm:grid-cols-[160px_1fr]"><div className="flex aspect-square flex-col items-center justify-center rounded-full border-[9px] border-white/10 bg-white/[.04] shadow-[inset_0_0_0_7px_rgba(223,163,74,.85)]"><span className="text-5xl font-semibold">91</span><span className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/55">Travel score</span></div>
            <div className="grid grid-cols-2 gap-3">{[['Walking','96'],['Photography','94'],['Nature','89'],['Dining','92']].map(([name, score]) => <div key={name} className="rounded-xl bg-white/[.07] p-4"><span className="block text-xs text-white/55">{name}</span><span className="mt-2 block text-2xl font-semibold">{score}</span><span className="mt-3 block h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-amber" style={{ width: `${score}%` }} /></span></div>)}</div></div>
          <div className="relative mt-6 flex items-center gap-3 rounded-xl bg-[#f3d39d] p-4 text-ink"><Sparkles size={18} className="shrink-0 text-forest" /><p className="text-sm"><strong>Best outdoor window:</strong> 09:00–15:00. Plan your nature walk before the late-afternoon rain chance.</p></div>
        </div>
      </div>
    </section>

    <section id="how" className="border-y border-black/8 bg-white"><div className="mx-auto max-w-[1400px] px-5 py-20 md:px-10 lg:px-16"><p className="eyebrow">A calmer way to travel</p><div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-black/8 bg-black/8 md:grid-cols-3">{[
      ['01','Choose the journey','Destination, dates, pace, and the experiences that matter to you.'],['02','Read the conditions','We score every day and hour against your plans—not generic averages.'],['03','Travel with confidence','Get a weather-aware itinerary, packing list, and timely change alerts.']
    ].map(([n,t,c]) => <article key={n} className="bg-[#fbfaf6] p-8 lg:p-10"><span className="font-mono text-xs text-forest">{n}</span><h3 className="mt-14 text-xl font-semibold">{t}</h3><p className="mt-3 text-sm leading-6 text-slate">{c}</p></article>)}</div></div></section>

    <section id="destinations" className="bg-[#132c23] px-5 py-20 text-white md:px-10 lg:px-16"><div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-10 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-amber">Start with the weather</p><h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-.04em] md:text-6xl">Your next good day is out there.</h2></div><Button variant="amber" size="lg" onClick={() => navigate('/register')}>Plan your trip <ArrowRight size={18} /></Button></div><div className="mx-auto mt-16 flex max-w-[1400px] items-center justify-between border-t border-white/10 pt-7 text-xs text-white/45"><Logo light /><span>Weather guidance, never weather guarantees.</span></div></section>
  </main>
}
