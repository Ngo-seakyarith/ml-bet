/**
 * Team logos, found automatically from src/assets/logos/<league>/.
 *
 * To add or change a team's logo, drop an image into its league folder named
 * after the team exactly as written in the CSV, lower-cased with spaces and
 * punctuation turned into hyphens:
 *
 *   "Bigetron by Vitality"  →  mpl-id/bigetron-by-vitality.png
 *   "AP.Bren"               →  mpl-ph/ap-bren.png
 *
 * Optional dark-mode version: add ".dark" before the extension
 * (team-secret.dark.png). PNG, WebP and SVG all work. Anything in the
 * asian-games folder is treated as a country flag.
 *
 * Sources: official MPL ID / PH / MY sites, Liquipedia (MSL Myanmar, MPL
 * Cambodia) and flagcdn.com. Logos are the teams' trademarks and are shown
 * only to identify them.
 */
export interface TeamLogo {
  src: string
  /** A separate version for dark mode, when the team publishes one. */
  darkSrc?: string
  /**
   * One-colour logos that vanish on one theme get a fixed tile behind them:
   * 'light' = white logo (dark tile), 'dark' = black logo (light tile).
   */
  ink?: 'light' | 'dark'
  /** Flags are rectangles; logos are roughly square. */
  shape?: 'flag'
}

/** "Bigetron by Vitality" → "bigetron-by-vitality". Also used for file names. */
export function teamSlug(team: string): string {
  return team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Logos that are a single colour and disappear on one theme. Only needed
 * when no dark-mode file exists; keyed by team name as written in the CSV.
 */
const INK: Record<string, TeamLogo['ink']> = {
  'Team Flash': 'light',
  'ONIC Esports': 'dark',
  'ONIC Philippines': 'dark',
  'Omega Esports': 'dark',
  'Team Vamos': 'dark',
}

const FLAG_FOLDERS = new Set(['asian-games'])

// Vite lists every image under the league folders at build time and hands
// back its final URL, so new files are picked up without touching this code.
const files = import.meta.glob('../assets/logos/*/*.{png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const INDEX = new Map<string, TeamLogo>()
for (const [path, url] of Object.entries(files)) {
  const match = /\/logos\/([^/]+)\/([^/]+?)(\.dark)?\.(png|webp|svg)$/.exec(path)
  if (!match) continue
  const [, folder = '', slug = '', dark] = match
  const entry = INDEX.get(slug) ?? { src: '' }
  if (dark) entry.darkSrc = url
  else entry.src = url
  if (FLAG_FOLDERS.has(folder)) entry.shape = 'flag'
  INDEX.set(slug, entry)
}

export function logoFor(team: string): TeamLogo | null {
  const entry = INDEX.get(teamSlug(team))
  if (!entry || !entry.src) return null
  const ink = INK[team]
  return ink && !entry.darkSrc ? { ...entry, ink } : entry
}

/** Two-letter fallback for teams without a logo, e.g. "Yangon Galacticos" → "YG". */
export function initialsFor(team: string): string {
  const words = team.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return (words[0] ?? '?').slice(0, 2).toUpperCase()
  return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase()
}
