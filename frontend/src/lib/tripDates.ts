function localDate(offset: number) { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export const defaultDeparture = localDate(1)
export const defaultReturn = localDate(3)
export const todayDate = localDate(0)
