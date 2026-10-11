import Papa from 'papaparse'
import phSeasonsText from '../data/MPL_PH_Seasons.csv?raw'
import idSeasonsText from '../data/MPL_ID_Seasons.csv?raw'
import mySeasonsText from '../data/MPL_MY_Seasons.csv?raw'
import type { Bet } from './types'

/**
 * Regular-season tables. Each league has one results file holding all its
 * seasons (one row per series, score from team_1's side, blank when not
 * played yet). The current MPL PH season is the exception: it is read from
 * the betting CSV, which already holds every PH match, so PH results are never
 * entered twice. The betting CSV only has the ID and MY matches you tracked,
 * so their current season lives in the results file with the others.
 */
const RESULT_FILES: readonly { league: string; text: string }[] = [
  { league: 'MPL PH', text: phSeasonsText },
  { league: 'MPL ID', text: idSeasonsText },
  { league: 'MPL MY', text: mySeasonsText },
]

/** Leagues with a table, in picker order. */
export const LEAGUES = ['MPL PH', 'MPL ID', 'MPL MY'] as const

export interface SeriesResult {
  week: number
  date: string
  teamA: string
  teamB: string
  /** Null for a fixture not played yet. */
  mapsA: number | null
  mapsB: number | null
}

export interface Season {
  id: string
  label: string
  league: string
  current: boolean
  results: SeriesResult[]
}

export interface StandingRow {
  rank: number
  team: string
  played: number
  wins: number
  losses: number
  mapsWon: number
  mapsLost: number
  /** Wins by 2-0 and 2-1, losses by 1-2 and 0-2. */
  w20: number
  w21: number
  l12: number
  l02: number
  /** Last five results, oldest first. */
  form: ('W' | 'L')[]
  /** Final rank last season, when there is one. */
  previousRank: number | null
  /** Matches still to play in the selected range. */
  remaining: number
}

const SCORE = /^(\d+)-(\d+)$/

/** One line of the past-seasons results file. */
interface HistoryRow {
  season: string
  week: string
  date: string
  team_1: string
  team_2: string
  score: string
}

const slug = (league: string) => league.replace(/\W+/g, '-').toLowerCase()

/** Every season in the results files, grouped by league and season number. */
function parseResultFiles(): Map<string, { league: string; season: number; results: SeriesResult[] }> {
  const seasons = new Map<string, { league: string; season: number; results: SeriesResult[] }>()
  for (const file of RESULT_FILES) {
    const parsed = Papa.parse<HistoryRow>(file.text, { header: true, skipEmptyLines: true })
    for (const row of parsed.data) {
      const match = SCORE.exec((row.score ?? '').trim())
      const key = `${slug(file.league)}-${row.season}`
      const entry = seasons.get(key) ?? { league: file.league, season: Number(row.season), results: [] }
      entry.results.push({
        week: Number(row.week),
        date: row.date,
        teamA: row.team_1,
        teamB: row.team_2,
        mapsA: match ? Number(match[1]) : null,
        mapsB: match ? Number(match[2]) : null,
      })
      seasons.set(key, entry)
    }
  }
  return seasons
}

/** This season's MPL PH matches, from the betting CSV (played and upcoming). */
function phFromBets(bets: readonly Bet[]): SeriesResult[] {
  return bets
    .filter((bet) => bet.league === 'MPL PH')
    .map<SeriesResult>((bet) => ({
      week: Number(/\d+/.exec(bet.officialWeek)?.[0] ?? 0),
      date: bet.date,
      teamA: bet.selectedTeam,
      teamB: bet.opponent,
      mapsA: bet.selectedMaps,
      mapsB: bet.opponentMaps,
    }))
}

/**
 * Every league's seasons, newest first within each league. The newest season
 * of a league is its current one; for MPL PH that is the season after the
 * last one in its results file, built from the betting CSV.
 */
export function seasonsFor(bets: readonly Bet[]): Season[] {
  const files = parseResultFiles()
  const out: Season[] = []
  for (const league of LEAGUES) {
    const list = [...files.values()].filter((s) => s.league === league).sort((a, b) => b.season - a.season)
    if (league === 'MPL PH') {
      const next = (list[0]?.season ?? 0) + 1
      list.unshift({ league, season: next, results: phFromBets(bets) })
    }
    list.forEach((s, i) =>
      out.push({
        id: `${slug(league)}-${s.season}`,
        label: i === 0 ? `Season ${s.season} (this season)` : `Season ${s.season}`,
        league,
        current: i === 0,
        results: s.results,
      }),
    )
  }
  return out
}

/**
 * The table after `throughWeek` (all weeks when null). Ranked by series
 * wins, then map difference, then maps won: the order MPL PH uses, and the
 * one that reproduces the official final tables in the results file.
 */
export function standings(season: Season, throughWeek: number | null, previous: Season | null): StandingRow[] {
  const inRange = season.results.filter((r) => throughWeek === null || r.week <= throughWeek)
  const rows = new Map<string, Omit<StandingRow, 'rank' | 'previousRank'>>()
  const row = (team: string) => {
    let entry = rows.get(team)
    if (!entry) {
      entry = { team, played: 0, wins: 0, losses: 0, mapsWon: 0, mapsLost: 0, w20: 0, w21: 0, l12: 0, l02: 0, form: [], remaining: 0 }
      rows.set(team, entry)
    }
    return entry
  }
  const ordered = [...inRange].sort((a, b) => a.date.localeCompare(b.date))
  for (const r of ordered) {
    const a = row(r.teamA)
    const b = row(r.teamB)
    if (r.mapsA === null || r.mapsB === null) {
      a.remaining++
      b.remaining++
      continue
    }
    for (const [me, mine, theirs] of [
      [a, r.mapsA, r.mapsB],
      [b, r.mapsB, r.mapsA],
    ] as const) {
      me.played++
      me.mapsWon += mine
      me.mapsLost += theirs
      const won = mine > theirs
      if (won) {
        me.wins++
        if (theirs === 0) me.w20++
        else me.w21++
      } else {
        me.losses++
        if (mine === 0) me.l02++
        else me.l12++
      }
      me.form = [...me.form, won ? ('W' as const) : ('L' as const)].slice(-5)
    }
  }
  const prevRanks = previous ? new Map(standings(previous, null, null).map((r) => [r.team, r.rank])) : null
  return [...rows.values()]
    .sort(
      (x, y) =>
        y.wins - x.wins ||
        y.mapsWon - y.mapsLost - (x.mapsWon - x.mapsLost) ||
        y.mapsWon - x.mapsWon ||
        x.team.localeCompare(y.team),
    )
    .map((r, i) => ({ ...r, rank: i + 1, previousRank: prevRanks?.get(r.team) ?? null }))
}

/**
 * Season 18 playoff formats: two cuts per league, the upper bracket and the
 * playoffs. All three send the top six on.
 * - PH and MY: seeds 1–2 start in the upper bracket (Round 2, double
 *   elimination); seeds 3–6 play a single-elimination Round 1.
 * - ID (Liquipedia bracket): seeds 3–6 play the upper bracket quarterfinals
 *   (3 v 6, 4 v 5; losers drop to the lower bracket) and seeds 1–2 wait in
 *   the upper bracket semifinal, so the top-2 cut is what matters here too.
 */
export interface Cutoff {
  spots: number
  label: string
}

export const PLAYOFF_FORMAT: Record<string, readonly [upper: Cutoff, playoffs: Cutoff]> = {
  'MPL PH': [
    { spots: 2, label: 'Upper bracket: top 2' },
    { spots: 6, label: 'Playoffs: top 6' },
  ],
  'MPL MY': [
    { spots: 2, label: 'Upper bracket: top 2' },
    { spots: 6, label: 'Playoffs: top 6' },
  ],
  'MPL ID': [
    { spots: 2, label: 'Upper bracket semifinal: top 2' },
    { spots: 6, label: 'Playoffs: top 6' },
  ],
}

export type Clinch = 'clinched' | 'out' | 'open'

/**
 * For each team and cutoff: clinched (inside the cutoff whatever happens),
 * out (cannot get inside it), or open. Every win/loss outcome of the
 * remaining matches is tried. Ties on wins are settled by the official
 * tiebreak, which this does not model, so a tie keeps both sides open: a team
 * is only clinched when it is strictly ahead and only out when strictly
 * behind. Once nothing is left to play, the table order decides.
 */
export function clinchStatus(season: Season, cutoffs: readonly Cutoff[]): Map<string, Clinch[]> {
  const table = standings(season, null, null)
  const teams = table.map((r) => r.team)
  const remaining = season.results.filter((r) => r.mapsA === null)
  const out = new Map<string, Clinch[]>()
  if (remaining.length === 0) {
    table.forEach((r) => out.set(r.team, cutoffs.map((c) => (r.rank <= c.spots ? 'clinched' : 'out'))))
    return out
  }
  // Past 16 matches (65k outcomes) fall back to "everything still possible".
  if (remaining.length > 16) {
    teams.forEach((t) => out.set(t, cutoffs.map(() => 'open')))
    return out
  }
  const base = new Map(table.map((r) => [r.team, r.wins]))
  const always = new Map(teams.map((t) => [t, cutoffs.map(() => true)]))
  const ever = new Map(teams.map((t) => [t, cutoffs.map(() => false)]))
  for (let mask = 0; mask < 1 << remaining.length; mask++) {
    const wins = new Map(base)
    remaining.forEach((r, i) => {
      const winner = mask & (1 << i) ? r.teamA : r.teamB
      wins.set(winner, (wins.get(winner) ?? 0) + 1)
    })
    for (const t of teams) {
      const mine = wins.get(t) ?? 0
      let ahead = 0
      let level = 0
      for (const o of teams) {
        if (o === t) continue
        const theirs = wins.get(o) ?? 0
        if (theirs > mine) ahead++
        else if (theirs === mine) level++
      }
      cutoffs.forEach((c, k) => {
        if (ahead + level >= c.spots) always.get(t)![k] = false
        if (ahead < c.spots) ever.get(t)![k] = true
      })
    }
  }
  teams.forEach((t) =>
    out.set(
      t,
      cutoffs.map((_, k) => (always.get(t)![k] ? 'clinched' : ever.get(t)![k] ? 'open' : 'out')),
    ),
  )
  return out
}

export interface PlaybookEvidence {
  /** Losses by the last-place team that were 0-2, over every season. */
  lastPlaceSwept: number
  lastPlaceLosses: number
  /** Weeks 1–2: the team ranked higher last season won this many of these matches. */
  earlyFavouriteWins: number
  earlyMatches: number
}

/**
 * The numbers behind the playbook calls, recomputed from every season so the
 * advice moves with the data instead of quoting a fixed figure.
 */
export function playbookEvidence(seasons: readonly Season[]): PlaybookEvidence {
  const out: PlaybookEvidence = { lastPlaceSwept: 0, lastPlaceLosses: 0, earlyFavouriteWins: 0, earlyMatches: 0 }
  seasons.forEach((season, i) => {
    const table = standings(season, null, null)
    const last = table.at(-1)
    if (last) {
      out.lastPlaceSwept += last.l02
      out.lastPlaceLosses += last.losses
    }
    const previous = seasons[i + 1]
    if (!previous) return
    const prevRank = new Map(standings(previous, null, null).map((r) => [r.team, r.rank]))
    for (const r of season.results) {
      if (r.week > 2 || r.mapsA === null || r.mapsB === null) continue
      const ra = prevRank.get(r.teamA)
      const rb = prevRank.get(r.teamB)
      if (ra === undefined || rb === undefined || ra === rb) continue
      out.earlyMatches++
      if ((ra < rb) === r.mapsA > r.mapsB) out.earlyFavouriteWins++
    }
  })
  return out
}

/** The highest week number with a played match, for the week picker. */
export function lastPlayedWeek(season: Season): number {
  return season.results.reduce((max, r) => (r.mapsA === null ? max : Math.max(max, r.week)), 0)
}

export function weeksIn(season: Season): number[] {
  return [...new Set(season.results.map((r) => r.week))].sort((a, b) => a - b)
}
