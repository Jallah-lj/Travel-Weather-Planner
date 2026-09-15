import { useEffect, useState } from 'react'
import type { UserSettings } from '../types'

const KEY = 'travel-weather:settings'
const defaults: UserSettings = { displayName: 'Jallah', temperatureUnit: 'C', distanceUnit: 'km', travelPace: 'balanced', emailAlerts: true, pushAlerts: true, severeWeatherOnly: false }
export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return defaults }
  })
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(settings)) }, [settings])
  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => setSettings(current => ({ ...current, [key]: value }))
  return { settings, update, reset: () => setSettings(defaults) }
}
