import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../layouts/AppShell'
export function NotificationsPage() {
  return <AppShell><main className="mx-auto max-w-5xl px-5 py-10 pb-28"><p className="eyebrow">Stay informed</p><h1 className="mt-3 text-4xl font-semibold">Notifications</h1><section className="mt-8 rounded-2xl border border-black/10 bg-white p-8"><Bell size={28} className="text-forest" /><h2 className="mt-5 text-xl font-semibold">Weather alerts are not connected yet</h2><p className="mt-3 text-sm leading-6 text-slate">Your trips show live model-based conditions when you open them. Automatic change notifications and official severe-weather alerts are not available here. Check your local meteorological authority for warnings.</p><Link to="/app/trips" className="mt-5 inline-block font-semibold text-forest underline">Review your trips</Link></section></main></AppShell>
}
