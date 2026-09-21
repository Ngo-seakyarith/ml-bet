/**
 * Chart colour assignment.
 *
 * Hues are handed out in fixed slot order and pinned to the entity, so a
 * filter that removes a league never repaints the leagues that remain. A
 * ninth category would fold into "Other" rather than inventing a hue.
 */

const LIGHT_SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const
const DARK_SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'] as const

export const OTHER_LABEL = 'Other'
const LIGHT_OTHER = '#898781'
const DARK_OTHER = '#898781'

export function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function seriesColors(dark = prefersDark()): readonly string[] {
  return dark ? DARK_SERIES : LIGHT_SERIES
}

export interface ColorAssignment {
  /** Stable category order, at most five plus "Other". */
  domain: string[]
  range: string[]
  /** Look up one category's colour. */
  colorOf: (category: string) => string
  /** Categories beyond slot five, folded into "Other". */
  overflow: string[]
}

/**
 * Assigns colours to categories in a caller-supplied stable order (we sort by
 * volume before calling, so the busiest leagues keep the leading slots).
 */
export function assignColors(categories: readonly string[], dark = prefersDark()): ColorAssignment {
  const palette = seriesColors(dark)
  const other = dark ? DARK_OTHER : LIGHT_OTHER

  const primary = categories.slice(0, palette.length)
  const overflow = categories.slice(palette.length)

  const domain = overflow.length > 0 ? [...primary, OTHER_LABEL] : [...primary]
  const range = overflow.length > 0
    ? [...palette.slice(0, primary.length), other]
    : [...palette.slice(0, primary.length)]

  const lookup = new Map<string, string>()
  primary.forEach((category, index) => lookup.set(category, palette[index] as string))
  for (const category of overflow) lookup.set(category, other)

  return {
    domain,
    range,
    colorOf: (category: string) => lookup.get(category) ?? other,
    overflow,
  }
}

/** Categories past slot five are reported as "Other" rather than a new hue. */
export function bucketCategory(category: string, assignment: ColorAssignment): string {
  return assignment.overflow.includes(category) ? OTHER_LABEL : category
}

/** Status colours are reserved and never reused as a series hue. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const

export function chartInk(dark = prefersDark()) {
  return {
    surface: dark ? '#1a1a19' : '#fcfcfb',
    primary: dark ? '#ffffff' : '#0b0b0b',
    secondary: dark ? '#c3c2b7' : '#52514e',
    muted: '#898781',
    grid: dark ? '#2c2c2a' : '#e1e0d9',
  }
}
