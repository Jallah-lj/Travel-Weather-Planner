import type { Destination, PrivatePlan, TripStop, TripStopInput } from '../../types'
export type DraftStop = { key: string; destination: Destination | null; arrival_date: string; departure_date: string }
export const dayCount = (start:string,end:string) => Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000)+1
export function addDays(value:string, offset:number) {const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)}
export function validateJourney(stops:DraftStop[],minDate?:string):string[] {
  const errors:string[]=[]
  if(!stops.length||stops.length>12)return ['Choose between 1 and 12 stops.']
  stops.forEach((stop,index)=>{
    if(!stop.destination)errors.push(`Stop ${index+1}: select a destination from the search results.`)
    if(!stop.arrival_date||!stop.departure_date||!Number.isFinite(dayCount(stop.arrival_date,stop.departure_date))||dayCount(stop.arrival_date,stop.departure_date)<1)errors.push(`Stop ${index+1}: choose a valid arrival and last day.`)
    if(minDate&&stop.arrival_date<minDate)errors.push(`Stop ${index+1}: new trips must start today or later.`)
    if(index&&stops[index-1].departure_date&&stop.arrival_date){
      const difference=dayCount(stops[index-1].departure_date,stop.arrival_date)-1
      if(difference<1)errors.push(`Stop ${index+1} overlaps the previous stop. Each day belongs to one destination.`)
      if(difference>1)errors.push(`There is a gap before stop ${index+1}. Assign travel days to the arriving destination.`)
    }
  })
  if(dayCount(stops[0].arrival_date,stops.at(-1)!.departure_date)>61)errors.push('Trips can last up to 61 calendar days.')
  return errors
}
export function stopPayload(stops:DraftStop[]):TripStopInput[]{return stops.map(stop=>({destination_id:stop.destination!.id,arrival_date:stop.arrival_date,departure_date:stop.departure_date}))}
export function planStops(plan:PrivatePlan):TripStop[]{return plan.stops?.length?plan.stops:[{id:'legacy-stop',position:0,destination:plan.destination,arrival_date:plan.departure_date,departure_date:plan.return_date}]}
export function stopForDate(stops:TripStop[],date:string){return stops.find(stop=>stop.arrival_date<=date&&date<=stop.departure_date)||stops[0]}
export function draftDestinationForDate(stops:DraftStop[],date:string){return stops.find(stop=>stop.arrival_date<=date&&date<=stop.departure_date)?.destination}
