import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Popover from '@radix-ui/react-popover'
import { Check, MapPin, Search } from 'lucide-react'
import { api } from '../../services/api'
import type { Destination } from '../../types'
import { Skeleton } from '../../components/ui/Skeleton'
import { scrollListOption } from '../../components/ui/ModernSelect'

export function DestinationSearch({ value, onSelect, variant = 'light', onClear }: { onClear?: () => void; value?: Destination | null; onSelect: (destination: Destination) => void; variant?: 'light' | 'plain' }) {
  const [query,setQuery]=useState(value?.name||''); const [debounced,setDebounced]=useState(query)
  const [open,setOpen]=useState(false); const [active,setActive]=useState(-1)
  const id=useId(); const anchor=useRef<HTMLDivElement>(null); const list=useRef<HTMLDivElement>(null)
  useEffect(()=>{const timer=setTimeout(()=>setDebounced(query.trim()),500);return()=>clearTimeout(timer)},[query])
  useEffect(()=>{if(value)setQuery(value.name)},[value])
  const {data=[],isFetching,isError,refetch}=useQuery({queryKey:['destinations',debounced],queryFn:()=>api.searchDestinations(debounced),enabled:open&&(debounced.length===0||debounced.length>=2),staleTime:300000,retry:false})
  const pending=query.trim()!==debounced||isFetching
  const results=!pending&&!isError&&query.trim().length!==1?data:[]
  useEffect(()=>{setActive(-1)},[query])
  useEffect(()=>{scrollListOption(list.current,active)},[active])
  const choose=(destination:Destination)=>{onSelect(destination);setQuery(destination.name);setOpen(false)}
  return <div className="min-w-0"><label htmlFor={id} className="form-label">Search worldwide</label><Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Anchor asChild><div ref={anchor} className={`modern-destination-input ${open?'is-open':''} ${variant==='plain'?'is-plain':''}`}><MapPin size={19} aria-hidden="true"/><input id={id} role="combobox" autoComplete="off" value={query} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);if(value&&e.target.value!==value.name)onClear?.();setOpen(true)}} onKeyDown={e=>{
      if(e.key==='Escape'||e.key==='Tab')setOpen(false)
      if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(index=>Math.min(index+1,results.length-1))}
      if(e.key==='ArrowUp'){e.preventDefault();setActive(index=>Math.max(index-1,0))}
      if(e.key==='Enter'&&open&&results[active]){e.preventDefault();choose(results[active])}
    }} placeholder="Where are you going?" aria-autocomplete="list" aria-expanded={open} aria-controls={open?`${id}-list`:undefined} aria-activedescendant={open&&results[active]?`${id}-option-${active}`:undefined}/>{value&&query===value.name?<Check size={18} aria-hidden="true"/>:<Search size={17} aria-hidden="true"/>}</div></Popover.Anchor>
    <Popover.Portal><Popover.Content className="modern-select-panel modern-destination-panel" align="start" sideOffset={7} collisionPadding={12} aria-label="Worldwide destination results" onOpenAutoFocus={event=>event.preventDefault()} onCloseAutoFocus={event=>event.preventDefault()} onInteractOutside={event=>{if(anchor.current?.contains(event.target as Node))event.preventDefault()}}>
      <div className="modern-select-heading"><span>{query?'Worldwide results':'Suggested destinations'}</span><span className="modern-select-count">{results.length}</span></div>
      {pending&&<div role="status" aria-label="Searching locations" className="space-y-2 p-3"><Skeleton className="h-12 w-full"/><Skeleton className="h-12 w-full"/></div>}
      {!pending&&isError&&<div role="alert" className="p-4 text-sm">Worldwide search is temporarily unavailable. <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={()=>refetch()}>Try again</button></div>}
      {!pending&&!isError&&query.trim().length===1&&<p className="p-4 text-sm text-slate">Enter at least two characters.</p>}
      <div ref={list} role="listbox" id={`${id}-list`} aria-label="Destination results" className="modern-select-list">{results.map((destination,index)=><button type="button" role="option" aria-selected={value?.id===destination.id} data-highlighted={active===index} data-index={index} key={destination.id} id={`${id}-option-${index}`} tabIndex={-1} className="modern-select-option" onPointerMove={event=>{if(event.pointerType==='mouse')setActive(index)}} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(destination)}><span className="modern-option-icon" aria-hidden="true">{destination.flag}</span><span className="modern-option-copy"><span dir="auto">{destination.name}</span><small dir="auto">{destination.name===destination.country?'Country':destination.country}{destination.destination_type&&destination.name!==destination.country?` · ${destination.destination_type}`:''}</small><small>{destination.latitude.toFixed(3)}°, {destination.longitude.toFixed(3)}°</small></span>{value?.id===destination.id&&<span className="modern-option-check" aria-hidden="true"><Check size={14}/></span>}</button>)}</div>
      {!pending&&!isError&&query.trim().length!==1&&!results.length&&<div className="modern-select-empty" role="status"><Search size={23}/><strong>No locations found</strong><p>Try a city, address, landmark, or add the country name.</p></div>}
      <p className="modern-select-footer">Search: Photon · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a></p>
    </Popover.Content></Popover.Portal>
  </Popover.Root></div>
}
