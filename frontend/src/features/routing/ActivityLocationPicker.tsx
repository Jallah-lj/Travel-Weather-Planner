import { useEffect, useId, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, MapPin, Search, X } from 'lucide-react'
import { api } from '../../services/api'
import type { GooglePlace, ItineraryItem } from '../../types'
import { Skeleton } from '../../components/ui/Skeleton'
import { GoogleAttribution } from './GoogleAttribution'
import { scrollListOption } from '../../components/ui/ModernSelect'

export function ActivityLocationPicker({tripId,dayDate,value,onChange,enabled}:{tripId:string;dayDate:string;value:ItineraryItem['location'];onChange:(value:ItineraryItem['location'])=>void;enabled:boolean}){
 const [open,setOpen]=useState(false);const [query,setQuery]=useState('');const [results,setResults]=useState<{place_id:string;text:string}[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [details,setDetails]=useState<GooglePlace|null>(null);const [active,setActive]=useState(0)
 const token=useRef(crypto.randomUUID());const input=useRef<HTMLInputElement>(null);const list=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const id=useId()
 useEffect(()=>{setDetails(current=>current?.place_id===value?.place_id?current:null)},[value?.place_id])
 useEffect(()=>{scrollListOption(list.current,active)},[active])
 useEffect(()=>{
  if(!open||query.trim().length<2){setResults([]);return}
  const controller=new AbortController();setBusy(true);setError('');setResults([])
  const timer=setTimeout(()=>{api.searchActivityPlaces(tripId,{query:query.trim(),day_date:dayDate,session_token:token.current},controller.signal).then(data=>{if(!controller.signal.aborted){setResults(data);setActive(0)}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setBusy(false)})},600)
  return()=>{clearTimeout(timer);controller.abort()}
 },[query,open,tripId,dayDate])
 async function select(placeId:string,resolveOnly=false){
  setBusy(true);setError('')
  try{const data=await api.activityPlaceDetails(tripId,{place_id:placeId,...(!resolveOnly?{session_token:token.current}:{})});if(!resolveOnly)onChange({provider:'google',place_id:data.place_id});setDetails(data);setOpen(false);token.current=crypto.randomUUID()}
  catch(e){setError(e instanceof Error?e.message:'Could not resolve this place. Nothing was linked.')}
  finally{setBusy(false)}
 }
 return <div className="min-w-0"><span className="form-label">Activity location</span><Popover.Root open={open} onOpenChange={next=>{setOpen(next);if(next){setQuery('');setError('');setBusy(false);token.current=crypto.randomUUID()}}}><Popover.Trigger asChild><button ref={trigger} type="button" disabled={!enabled} className="modern-select-trigger" aria-label="Choose activity location"><MapPin size={17}/><span className="modern-select-value"><span>{value?'Google place linked':'Location needed'}</span></span>{value?<Check size={16}/>:<Search size={16}/>}</button></Popover.Trigger><Popover.Portal><Popover.Content className="modern-select-panel" align="start" sideOffset={7} collisionPadding={12} aria-label="Find an activity location" onOpenAutoFocus={e=>{e.preventDefault();input.current?.focus({preventScroll:true})}} onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus({preventScroll:true})}}>
 <div className="modern-select-search"><Search size={17}/><input ref={input} role="combobox" aria-label="Search Google places" aria-controls={id} aria-expanded="true" aria-autocomplete="list" aria-activedescendant={results[active]?`${id}-${active}`:undefined} autoComplete="off" placeholder="Venue, address, or landmark…" maxLength={150} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,results.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(i-1,0))}if(e.key==='Enter'&&results[active]&&!busy){e.preventDefault();select(results[active].place_id)}}}/></div><div className="modern-select-heading">Results near this stop</div>
 {busy&&<div role="status" aria-label="Looking up places" className="space-y-2 p-3"><Skeleton className="h-12 w-full"/><Skeleton className="h-12 w-full"/></div>}
 {error&&<p role="alert" className="p-4 text-sm text-red-700">{error}</p>}
 <div id={id} ref={list} role="listbox" aria-label="Google places" className="modern-select-list">{!busy&&results.map((item,index)=><button type="button" role="option" aria-selected={item.place_id===value?.place_id} data-highlighted={index===active} data-index={index} id={`${id}-${index}`} key={item.place_id} tabIndex={-1} className="modern-select-option" onMouseDown={e=>e.preventDefault()} onClick={()=>select(item.place_id)}><MapPin size={16} className="shrink-0"/><span className="modern-option-copy">{item.text}</span></button>)}</div>
 {!busy&&!error&&<p className="px-4 py-3 text-xs text-slate">{query.length<2?'Type at least two characters. Locations may be outside this stop—check before selecting.':!results.length?'No matching places. Try adding the city name.':'Select a physical location to link its place ID.'}</p>}
 <GoogleAttribution/>
 </Popover.Content></Popover.Portal></Popover.Root>
 {value&&<div className="mt-2 flex flex-wrap items-center gap-3 text-xs"><button type="button" disabled={!enabled||busy} className="min-h-10 font-semibold text-forest underline" onClick={()=>select(value.place_id,true)}>View linked place</button><button type="button" className="flex min-h-10 items-center gap-1 text-slate" onClick={()=>{onChange(null);setDetails(null);setError('')}}><X size={13}/>Remove location</button></div>}
 {!enabled&&<p className="mt-2 text-xs text-slate">Google Places requires Maps Platform setup.</p>}
 {!open&&error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
 {details&&<div className="mt-2 rounded-xl border border-black/10 bg-white p-3 text-xs"><strong>{details.name}</strong><p className="mt-1 text-slate">{details.address}</p><p className="mt-2 text-slate">Location resolved by Google. Opening hours and availability are not checked. Only the place ID is saved.</p><GoogleAttribution attributions={details.attributions}/></div>}
 </div>
}
