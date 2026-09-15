import { Cloud, CloudLightning, CloudRain, CloudSun, MoonStar, Snowflake, Sun } from 'lucide-react'
import { cn } from '../../lib/cn'

const icons = { sun: Sun, cloudy: Cloud, partly_cloudy: CloudSun, rain: CloudRain, storm: CloudLightning, snow: Snowflake, night: MoonStar }
export function WeatherIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name as keyof typeof icons] || CloudSun
  return <Icon className={cn('text-amber', className)} strokeWidth={1.7} aria-hidden="true" />
}
