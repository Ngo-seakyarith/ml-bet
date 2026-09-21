/** Display helpers. Every one returns an em dash for "no data", never 0. */

export const EMPTY = '—'

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  return `${(value * 100).toFixed(digits)}%`
}

/** ROI and profit read better with an explicit sign. */
export function signedPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  const formatted = `${(value * 100).toFixed(digits)}%`
  return value > 0 ? `+${formatted}` : formatted
}

export function units(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  const formatted = value.toFixed(digits)
  return value > 0 ? `+${formatted}` : formatted
}

export function odds(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  return value.toFixed(2)
}

export function record(wins: number, losses: number): string {
  return `${wins}-${losses}`
}

/** "Sep 11-13 2026" -> "Sep 11-13" for tight table headers. */
export function shortWeek(week: string): string {
  return week.replace(/\s*\d{4}$/, '')
}

export function shortDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Sign class for profit-like numbers. Zero is neutral, not green. */
export function toneFor(value: number | null | undefined): 'good' | 'bad' | 'flat' {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return 'flat'
  return value > 0 ? 'good' : 'bad'
}
