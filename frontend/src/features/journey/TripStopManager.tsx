import { useState } from 'react'
import { MapPin } from 'lucide-react'
import type { PrivatePlan } from '../../types'
import { api } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { StopEditor } from './StopEditor'
import { planStops, stopPayload, validateJourney, type DraftStop } from './journey'
export function TripStopManager({plan,disabled,onSaved,onEditingChange}:{plan:PrivatePlan;disabled:boolean;onSaved:(plan:PrivatePlan)=>void;onEditingChange:(editing:boolean)=>void}){
 const [open,setOpen]=useState(false);const [stops,setStops]=useState<DraftStop[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('')
 const close=()=>{setOpen(false);onEditingChange(false);setError('')}
 async function save(){
  const hasActivities=plan.itinerary.some(day=>day.items.length)
  if(hasActivities&&!window.confirm('Keep existing activities on their current dates? If destinations or timezones change, you must review those activities and local times. Days containing activities will never be removed automatically.'))return
  setBusy(true);setError('')
  try{const saved=await api.saveStops(plan.trip_id,{revision:plan.revision,stops:stopPayload(stops),confirm_reassignment:hasActivities});onSaved(saved);close()}
  catch(e){setError(e instanceof Error?e.message:'Could not save stops. Your edits are still here.')}
  finally{setBusy(false)}
 }
 return <section className="mt-5 rounded-2xl border border-black/10 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Destinations & dates</h2><p className="mt-1 text-xs text-slate">{disabled?'Save itinerary changes before managing stops.':'Add or adjust stops without deleting your saved activities.'}</p></div><Button variant="secondary" disabled={disabled||busy} aria-expanded={open} onClick={()=>{if(open)close();else{setStops(planStops(plan).map(stop=>({key:stop.id,destination:stop.destination,arrival_date:stop.arrival_date,departure_date:stop.departure_date})));setOpen(true);onEditingChange(true)}}}><MapPin size={16}/>{open?'Cancel stop changes':'Manage stops'}</Button></div>{open&&<fieldset disabled={busy} className="mt-5"><StopEditor stops={stops} onChange={setStops}/>{error&&<p role="alert" className="mt-4 rounded-xl border border-red-200 p-4 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end"><Button disabled={!!validateJourney(stops).length||busy} onClick={save}>{busy?'Saving stops…':'Save stops'}</Button></div></fieldset>}</section>
}
