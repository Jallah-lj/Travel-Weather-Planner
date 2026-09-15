import { useMemo } from 'react'
import type { Destination } from '../../types'
import { ModernSelect } from '../../components/ui/ModernSelect'
import { destinationDescription, orderDestinations } from './orderDestinations'

export function DestinationPicker({ value, destinations, onSelect }: { value: Destination | null; destinations: Destination[]; onSelect: (destination: Destination) => void }) {
  const ordered = useMemo(() => orderDestinations(value && !destinations.some(item => item.id === value.id) ? [...destinations,value] : destinations), [destinations,value])
  return <div><label htmlFor="map-destination" className="form-label">Find a destination</label><ModernSelect id="map-destination" label="Find a destination" value={value?.id || ''} onValueChange={id => {const destination=ordered.find(item=>item.id===id);if(destination)onSelect(destination)}} options={ordered.map(item=>({value:item.id,label:item.name.trim(),description:destinationDescription(item,ordered),icon:item.flag,keywords:item.country}))} placeholder="Choose a destination" searchable searchLabel="Filter destinations" searchPlaceholder="Search by city or country…" footer="Destinations A–Z · Country breaks name ties" emptyMessage="Use Search worldwide above to find somewhere new." roomy /></div>
}
