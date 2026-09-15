import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'amber'; size?: 'sm' | 'md' | 'lg'; children: ReactNode }
export function Button({ className, variant = 'primary', size = 'md', children, ...props }: Props) {
  return <button className={cn('inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:translate-y-px',
    variant === 'primary' && 'bg-forest text-white hover:bg-[#0f3a29] shadow-sm',
    variant === 'secondary' && 'bg-white text-ink border border-black/10 hover:border-black/20 hover:bg-cream/50',
    variant === 'ghost' && 'text-ink hover:bg-black/5', variant === 'amber' && 'bg-amber text-ink hover:bg-[#e8b45f]',
    size === 'sm' && 'h-9 px-3 text-sm rounded-lg', size === 'md' && 'h-11 px-5 text-sm rounded-xl', size === 'lg' && 'h-14 px-7 text-base rounded-xl', className)} {...props}>{children}</button>
}
