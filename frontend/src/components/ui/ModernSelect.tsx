import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export type SelectOption = { value: string; label: string; description?: string; icon?: ReactNode; keywords?: string; disabled?: boolean }
export function scrollListOption(list: HTMLElement | null, index: number) {
  const option = list?.querySelector<HTMLElement>(`[data-index="${index}"]`)
  if (!list || !option) return
  const top = option.getBoundingClientRect().top - list.getBoundingClientRect().top
  if (top < 0) list.scrollTop += top
  else if (top + option.offsetHeight > list.clientHeight) list.scrollTop += top + option.offsetHeight - list.clientHeight
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export function ModernSelect({ id, label, value, onValueChange, options, placeholder = 'Choose an option', searchable = options.length > 6, searchPlaceholder = 'Search options…', searchLabel, disabled = false, footer, emptyMessage = 'Try another search.', roomy = false }: {
  id?: string; label: string; value: string; onValueChange: (value: string) => void; options: SelectOption[];
  placeholder?: string; searchable?: boolean; searchPlaceholder?: string; searchLabel?: string; disabled?: boolean; footer?: string; emptyMessage?: string; roomy?: boolean;
}) {
  const uid = useId(); const listId = `${uid}-options`
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [active, setActive] = useState(0)
  const panel = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const input = useRef<HTMLInputElement>(null); const list = useRef<HTMLDivElement>(null)
  const outside = useRef(false)
  const typeahead = useRef(''); const lastTyped = useRef(0)
  const selected = options.find(option => option.value === value)
  const matches = options.filter(option => normalize(`${option.label} ${option.description || ''} ${option.keywords || ''}`).includes(normalize(query.trim())))
  const changeOpen = (next: boolean) => { if (next && trigger.current?.matches(':disabled')) return; setOpen(next); if (next) { outside.current = false; setQuery(''); setActive(Math.max(0, options.findIndex(option => option.value === value))); typeahead.current = '' } }
  useEffect(() => { if (open) scrollListOption(list.current, active) }, [active, open])
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  const choose = (option?: SelectOption) => { if (!option || option.disabled || trigger.current?.matches(':disabled')) return; onValueChange(option.value); setOpen(false) }
  function navigate(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); const delta = event.key === 'ArrowDown' ? 1 : -1
      let next = active
      for (let i = 0; i < matches.length; i++) { next = (next + delta + matches.length) % matches.length; if (!matches[next].disabled) break }
      setActive(next)
    }
    if ((event.key === 'Home' || event.key === 'End') && (!searchable || event.ctrlKey)) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : matches.length - 1) }
    if (event.key === 'Enter' || (!searchable && event.key === ' ')) { event.preventDefault(); choose(matches[active]) }
    if (!searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== ' ') {
      const now = Date.now(); typeahead.current = now-lastTyped.current > 700 ? event.key : typeahead.current+event.key; lastTyped.current = now
      const index = matches.findIndex(option => !option.disabled && normalize(option.label).startsWith(normalize(typeahead.current)))
      if (index >= 0) setActive(index)
    }
  }
  return <Popover.Root open={open} onOpenChange={changeOpen}>
    <Popover.Trigger asChild><button id={id} ref={trigger} type="button" disabled={disabled} aria-label={label} className={`modern-select-trigger ${roomy ? 'is-roomy' : ''}`} onKeyDown={event => { if (!open && ['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); changeOpen(true) } }}>
      {selected?.icon && <span className="modern-option-icon" aria-hidden="true">{selected.icon}</span>}
      <span className="modern-select-value"><span dir="auto" className={selected ? '' : 'modern-muted'}>{selected?.label || placeholder}</span>{roomy && selected?.description && <small dir="auto">{selected.description}</small>}</span><ChevronDown size={17} className="modern-select-chevron" aria-hidden="true" />
    </button></Popover.Trigger>
    <Popover.Portal><Popover.Content ref={panel} className="modern-select-panel" align="start" sideOffset={7} collisionPadding={12} aria-label={label} onOpenAutoFocus={event => { event.preventDefault(); (searchable ? input.current : list.current)?.focus({preventScroll:true}); requestAnimationFrame(() => scrollListOption(list.current, active)) }} onInteractOutside={event => { if (!trigger.current?.contains(event.target as Node)) outside.current = true }} onCloseAutoFocus={event => { event.preventDefault(); const focused = document.activeElement; if (!outside.current && (!focused || focused === document.body || focused === trigger.current || panel.current?.contains(focused))) trigger.current?.focus({preventScroll:true}); outside.current = false }}>
      {searchable && <div className="modern-select-search"><Search size={17} aria-hidden="true" /><input ref={input} value={query} autoComplete="off" placeholder={searchPlaceholder} role="combobox" aria-label={searchLabel || `Search ${label.toLowerCase()}`} aria-expanded="true" aria-controls={listId} aria-activedescendant={matches[active] ? `${uid}-option-${active}` : undefined} onChange={event => {setQuery(event.target.value);setActive(0)}} onKeyDown={navigate} />{query && <button type="button" aria-label="Clear search" onClick={() => {setQuery('');setActive(0);input.current?.focus({preventScroll:true})}}><X size={15}/></button>}</div>}
      <div className="modern-select-heading"><span>{query ? 'Search results' : label}</span><span className="modern-select-count" aria-live="polite">{matches.length}</span></div>
      <div ref={list} id={listId} role="listbox" aria-label={label} aria-activedescendant={!searchable && matches[active] ? `${uid}-option-${active}` : undefined} tabIndex={searchable ? -1 : 0} onKeyDown={searchable ? undefined : navigate} className="modern-select-list">
        {matches.map((option,index) => <button type="button" key={option.value} role="option" aria-selected={value===option.value} aria-disabled={option.disabled || undefined} disabled={option.disabled} id={`${uid}-option-${index}`} data-index={index} data-highlighted={active===index} tabIndex={-1} className="modern-select-option" onPointerMove={event => {if(event.pointerType==='mouse')setActive(index)}} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
          {option.icon && <span className="modern-option-icon" aria-hidden="true">{option.icon}</span>}<span className="modern-option-copy"><span dir="auto">{option.label}</span>{option.description && <small dir="auto">{option.description}</small>}</span>{value===option.value && <span className="modern-option-check" aria-hidden="true"><Check size={14} strokeWidth={2.5}/></span>}
        </button>)}
      </div>
      {!matches.length && <div className="modern-select-empty" role="status"><Search size={23}/><strong>No matches found</strong><p>{emptyMessage}</p></div>}
      {footer && <div className="modern-select-footer">{footer}</div>}
    </Popover.Content></Popover.Portal>
  </Popover.Root>
}
