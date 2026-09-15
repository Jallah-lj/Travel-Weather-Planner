import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export function ActionMenu({ label, items }: { label: string; items: { label: string; icon?: ReactNode; href?: string; onSelect?: () => void; danger?: boolean; disabled?: boolean }[] }) {
  return <DropdownMenu.Root modal={false}><DropdownMenu.Trigger asChild><button type="button" className="modern-action-trigger" aria-label={label}><MoreHorizontal size={18}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={7} collisionPadding={12} className="modern-action-panel" aria-label={label}>
    <DropdownMenu.Label className="modern-select-heading">{label}</DropdownMenu.Label>
    {items.map((item,index)=><DropdownMenu.Item key={index} disabled={item.disabled} onSelect={item.onSelect} className={`modern-action-item ${item.danger?'is-danger':''}`} asChild={!!item.href}>{item.href?<Link to={item.href}>{item.icon}<span>{item.label}</span></Link>:<><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></>}</DropdownMenu.Item>)}
  </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
}
