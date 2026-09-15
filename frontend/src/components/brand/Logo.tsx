import { Wind } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export function Logo({ light = false, compact = false, to = '/' }: { light?: boolean; compact?: boolean; to?: string }) {
  return <Link to={to} className={cn('inline-flex items-center gap-3 font-bold tracking-[-.02em]', light ? 'text-white' : 'text-ink')} aria-label="Travel Weather home">
    <span className={cn('grid h-9 w-9 place-items-center rounded-full', light ? 'bg-white text-forest' : 'bg-forest text-white')}><Wind size={18} strokeWidth={2.2} /></span>
    {!compact && <span className="leading-none"><span className="block text-[15px] tracking-[.03em]">TRAVEL WEATHER</span><span className={cn('mt-1 block text-[9px] font-medium uppercase tracking-[.24em]', light ? 'text-white/65' : 'text-slate')}>Plan with confidence</span></span>}
  </Link>
}
