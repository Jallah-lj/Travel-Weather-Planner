import { ModernSelect } from '../../components/ui/ModernSelect'
import { formatLocalDateTime } from '../locale/preferences'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Copy, Download, FileDown, Link2, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'

export function TripTools({ tripId, dirty }: { tripId: string; dirty: boolean }) {
  const [sharing, setSharing] = useState(false)
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [days, setDays] = useState(7)
  const [link, setLink] = useState(''); const [createdId, setCreatedId] = useState('')
  const [busy, setBusy] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState('')
  const shares = useQuery({ queryKey: ['trip-shares', tripId], queryFn: () => api.listShares(tripId), enabled: sharing, retry: false })
  async function createLink() {
    setBusy('create'); setError(''); setNotice(''); setLink('')
    try { const result = await api.createShare(tripId, permission, days); setCreatedId(result.id); setLink(`${window.location.origin}/share#token=${encodeURIComponent(result.token)}`); await shares.refetch(); setNotice('Link created. Copy it now; the full link is only shown once.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create link.') }
    finally { setBusy('') }
  }
  async function revoke(id: string) {
    setBusy(id); setError(''); setNotice('')
    try { await api.revokeShare(tripId, id); if (createdId === id) setLink(''); await shares.refetch(); setNotice('Link revoked. It can no longer load or save this trip.') }
    catch(e) { setError(e instanceof Error ? e.message : 'Could not revoke link.') }
    finally { setBusy('') }
  }
  async function download(kind: 'calendar' | 'pdf' | 'offline') {
    setBusy(kind); setError(''); setNotice('')
    try {
      const blob = await api.exportTrip(tripId, kind); const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `trip-${tripId}.${kind === 'calendar' ? 'ics' : kind === 'pdf' ? 'pdf' : 'html'}`; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000)
      setNotice(kind === 'offline' ? 'Offline copy downloaded. Open the HTML file from your device’s Files or Downloads folder, even without internet.' : 'Export downloaded from the last saved plan.')
    } catch(e) { setError(e instanceof Error ? e.message : 'Export failed. Please try again.') }
    finally { setBusy('') }
  }
  return <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5" aria-label="Sharing and exports">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Take your plans with you</h2><p className="mt-1 text-xs leading-5 text-slate">Share securely or download a copy of your saved trip.</p></div><Button variant="secondary" onClick={() => setSharing(value => !value)} aria-expanded={sharing} aria-controls="trip-sharing-panel"><Link2 size={16} />{sharing ? 'Close sharing' : 'Manage sharing'}</Button></div>
    <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={dirty || !!busy} onClick={() => download('calendar')}><CalendarDays size={15} />{busy === 'calendar' ? 'Exporting…' : 'Export calendar'}</Button><Button size="sm" variant="secondary" disabled={dirty || !!busy} onClick={() => download('pdf')}><FileDown size={15} />{busy === 'pdf' ? 'Exporting…' : 'Export PDF'}</Button><Button size="sm" variant="secondary" disabled={dirty || !!busy} onClick={() => download('offline')}><Download size={15} />{busy === 'offline' ? 'Preparing…' : 'Download offline copy'}</Button></div>
    <p className="mt-3 text-xs leading-5 text-slate">{dirty ? 'Save all changes before creating links or exporting.' : 'Calendar: activities use destination-local times; packing tasks may not appear in every calendar app. PDF and offline copies include both lists.'}</p>
    <p className="mt-2 text-xs leading-5 text-slate">Offline access is a standalone HTML file, not the entire app. It has no live weather or maps and does not sync. Keep downloaded files private.</p>
    {sharing && <div id="trip-sharing-panel" className="mt-5 border-t border-black/10 pt-5"><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-forest" />You control who has the link</p><p className="mt-2 text-xs leading-5 text-slate">Anyone holding a link can access this trip without signing in. Edit links can change the itinerary and packing list, but cannot delete the trip or manage sharing. Link revocation cannot remove already viewed or downloaded copies.</p>
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"><label htmlFor="share-permission"><span className="form-label">Permission</span><ModernSelect id="share-permission" label="Permission" value={permission} onValueChange={value=>setPermission(value as 'view'|'edit')} options={[{value:'view',label:'View only',description:'Can view your saved plan'},{value:'edit',label:'Can edit plan',description:'Can change itinerary and packing'}]} searchable={false} disabled={!!busy} /></label><label htmlFor="share-expiry"><span className="form-label">Expires after</span><ModernSelect id="share-expiry" label="Expires after" value={String(days)} onValueChange={value=>setDays(Number(value))} options={[{value:'1',label:'1 day'},{value:'7',label:'7 days'},{value:'30',label:'30 days'}]} searchable={false} disabled={!!busy} /></label><Button onClick={createLink} disabled={dirty || !!busy}>{busy === 'create' ? 'Creating…' : 'Create link'}</Button></div>
      {link && <div className="mt-4 rounded-xl bg-cream p-3"><label className="form-label" htmlFor="new-share-link">New private link — copy before leaving</label><div className="flex flex-wrap gap-2"><input id="new-share-link" className="form-input min-w-0 flex-1" readOnly value={link} onFocus={e => e.currentTarget.select()} /><Button variant="secondary" aria-label="Copy share link" onClick={async () => { try { await navigator.clipboard.writeText(link); setNotice('Link copied.') } catch { setNotice('Select and copy the link manually above.') } }}><Copy size={16} /></Button></div></div>}
      {shares.isLoading ? <Skeleton className="mt-4 h-24 w-full" /> : shares.isError ? <p role="alert" className="mt-4 text-sm">Could not load existing links. <button className="underline" onClick={() => shares.refetch()}>Retry</button></p> : <ul className="mt-5 space-y-2" aria-label="Trip sharing links">{shares.data?.map((item, index) => { const expired = Date.parse(item.expires_at) <= Date.now(); return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3"><div><p className="text-sm font-semibold">{item.permission === 'edit' ? 'Can edit plan' : 'View only'} · {item.revoked ? 'Revoked' : expired ? 'Expired' : 'Active'}</p><p className="mt-1 text-xs text-slate">Created {formatLocalDateTime(item.created_at)}<br />Expires {formatLocalDateTime(item.expires_at)}</p></div>{!item.revoked && !expired && <Button size="sm" variant="secondary" disabled={!!busy} aria-label={`Revoke link ${index + 1}`} onClick={() => revoke(item.id)}><Trash2 size={14} />Revoke</Button>}</li> })}{shares.data?.length === 0 && <li className="text-sm text-slate">No sharing links. Only your account can access this trip.</li>}</ul>}
    </div>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-cream p-3 text-sm text-forest">{notice}</p>}{error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>
}
