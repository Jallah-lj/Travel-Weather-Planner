import { useEffect, useRef, useState } from 'react'
import type { ActivityRoute, ItineraryItem } from '../../types'
import { Skeleton } from '../../components/ui/Skeleton'

declare global { interface Window { travelGoogleReady?:()=>void; gm_authFailure?:()=>void } }
let loading:Promise<void>|null=null
function loadMaps(key:string):Promise<void>{
 if(typeof google!=='undefined'&&google.maps?.Map)return Promise.resolve()
 if(loading)return loading
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.id='travel-google-maps';script.async=true;script.referrerPolicy='strict-origin-when-cross-origin'
  const timer=window.setTimeout(()=>{loading=null;script.remove();reject(new Error('Google Maps did not load. Check your network or browser key restrictions.'))},20000)
  window.travelGoogleReady=()=>{clearTimeout(timer);resolve()}
  window.gm_authFailure=()=>{clearTimeout(timer);loading=null;window.dispatchEvent(new Event('google-maps-auth-error'));reject(new Error('Google Maps authentication failed.'))}
  script.onerror=()=>{clearTimeout(timer);loading=null;script.remove();reject(new Error('Google Maps could not load.'))}
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=geometry&v=quarterly&callback=travelGoogleReady`
  document.head.append(script)
 })
 return loading
}
export function GoogleRouteMap({browserKey,route,items}:{browserKey:string;route:ActivityRoute;items:ItineraryItem[]}){
 const ref=useRef<HTMLDivElement>(null);const [error,setError]=useState('');const [ready,setReady]=useState(false);const [attempt,setAttempt]=useState(0)
 useEffect(()=>{
  if(!browserKey)return
  let cancelled=false;let cleanup=()=>{}
  setReady(false);setError('')
  const authError=()=>setError('Google Maps rejected the browser key. Check website restrictions, billing and Maps JavaScript API enablement.')
  window.addEventListener('google-maps-auth-error',authError)
  loadMaps(browserKey).then(()=>{
   if(cancelled||!ref.current)return
   const map=new google.maps.Map(ref.current,{center:{lat:route.legs[0].start.latitude,lng:route.legs[0].start.longitude},zoom:13,streetViewControl:false,mapTypeControl:false,fullscreenControl:true,gestureHandling:'cooperative'})
   const path=google.maps.geometry.encoding.decodePath(route.polyline)
   if(path.length<2)throw new Error('Google returned an unusable route geometry.')
   const line=new google.maps.Polyline({map,path,strokeColor:'#174b36',strokeOpacity:1,strokeWeight:5})
   const bounds=new google.maps.LatLngBounds();path.forEach(point=>bounds.extend(point));map.fitBounds(bounds,45)
   const points=[route.legs[0].start,...route.legs.map(leg=>leg.end)]
   class StopMarker extends google.maps.OverlayView {
    node:HTMLButtonElement;position:google.maps.LatLng
    constructor(point:{latitude:number;longitude:number},index:number){super();this.position=new google.maps.LatLng(point.latitude,point.longitude);this.node=document.createElement('button');this.node.type='button';this.node.className='google-route-pin';this.node.textContent=String(index+1);this.node.setAttribute('aria-label',`Route stop ${index+1}: ${items[index]?.title||'Activity'}`);this.node.onclick=()=>{const content=document.createElement('span');content.textContent=items[index]?.title||'Activity';const popup=new google.maps.InfoWindow({content,position:this.position});popup.open(map)};this.setMap(map)}
    onAdd(){this.getPanes()?.overlayMouseTarget.append(this.node)}
    draw(){const p=this.getProjection().fromLatLngToDivPixel(this.position);if(p){this.node.style.left=p.x+'px';this.node.style.top=p.y+'px'}}
    onRemove(){this.node.remove()}
   }
   const markers=points.map((point,index)=>new StopMarker(point,index));const observer=new ResizeObserver(()=>google.maps.event.trigger(map,'resize'));observer.observe(ref.current)
   cleanup=()=>{observer.disconnect();markers.forEach(marker=>marker.setMap(null));line.setMap(null);google.maps.event.clearInstanceListeners(map)}
   setReady(true)
  }).catch(e=>{if(!cancelled)setError(e.message||'Map unavailable.')})
  return()=>{cancelled=true;cleanup();window.removeEventListener('google-maps-auth-error',authError)}
 },[browserKey,route,items,attempt])
 if(!browserKey)return <p className="rounded-xl bg-cream p-4 text-sm text-slate">Route estimates are available below. A restricted Maps JavaScript browser key is required to display the Google map.</p>
 return <div className="relative overflow-hidden rounded-2xl border border-black/10"><div ref={ref} className={`h-[420px] w-full sm:h-[500px] ${error?'invisible':''}`} role="region" aria-label="Google activity route map"/>{!ready&&!error&&<div className="absolute inset-0 bg-cream p-5"><Skeleton className="h-full w-full"/></div>}{error&&<div role="alert" className="absolute inset-0 flex flex-col items-center justify-center bg-cream p-6 text-center text-sm"><p>{error}</p><button type="button" className="mt-3 font-semibold underline" onClick={()=>setAttempt(v=>v+1)}>Retry map</button></div>}</div>
}
