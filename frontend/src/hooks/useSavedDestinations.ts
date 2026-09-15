import { useEffect, useState } from 'react'
import type { Destination } from '../types'

const KEY = 'travel-weather:saved-destinations'
export function useSavedDestinations() {
  const [saved, setSaved] = useState<Destination[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Destination[] } catch { return [] }
  })
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(saved)) }, [saved])
  const isSaved = (id: string) => saved.some(item => item.id === id)
  const toggle = (destination: Destination) => setSaved(current => isSaved(destination.id) ? current.filter(item => item.id !== destination.id) : [...current, destination])
  return { saved, isSaved, toggle }
}
