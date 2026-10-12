import Papa from 'papaparse'
import phSeasonsText from '../data/MPL_PH_Seasons.csv?raw'
import idSeasonsText from '../data/MPL_ID_Seasons.csv?raw'
import mySeasonsText from '../data/MPL_MY_Seasons.csv?raw'

/**
 * Regular-season tables. Each league has one results file holding all its
 * seasons, the current one included (fixtures not played yet have a blank
 * score). MY has one row per series with its score; PH and ID have one row
 * per game with that game's stats, and the series score is counted from the
 * game winners.
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
  /** Per-game detail, when the league's file has one row per game (PH, ID). */
  details?: GameDetail[]
}

/** One player and the hero they played. */
export interface Pick {
  player: string
  hero: string
}

/** One game of a series, with each stat as [teamA, teamB]. Null where the file has no such column. */
export interface GameDetail {
  game: number
  winner: string
  /** Minutes. */
  duration: number | null
  kills: [number, number] | null
  lords: [number, number] | null
  turtles: [number, number] | null
  towers: [number, number] | null
  picks: [Pick[], Pick[]]
}

export interface Season {
  id: string
  label: string
  league: string
  current: boolean
  results: SeriesResult[]
}

/** One of a team's matches, from that team's side. */
export interface TeamGame {
  week: number
  date: string
  opponent: string
  /** Null until played. */
  mapsFor: number | null
  mapsAgainst: number | null
  /** The series' games, when known; stats and picks are [this team, opponent]. */
  details?: GameDetail[]
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
  /** Every match in the selected range, oldest first, including ones not played yet. */
  games: TeamGame[]
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
  /** Series files: the series score from team_1's side. */
  score?: string
  /** Per-game files: the game number (blank for a fixture not played) and its winner. */
  game?: string
  winner?: string
  /** Per-game stats and lineups (team_1_player_1, team_1_hero_1, ...). */
  [column: string]: string | undefined
}

const pair = (row: HistoryRow, name: string): [number, number] | null => {
  const a = row[`${name}_1`]
  const b = row[`${name}_2`]
  if (a === undefined || b === undefined || a.trim() === '' || b.trim() === '') return null
  return [Number(a), Number(b)]
}

function gameDetail(row: HistoryRow): GameDetail {
  const picks = (side: 1 | 2): Pick[] =>
    [1, 2, 3, 4, 5].flatMap((k) => {
      const hero = (row[`team_${side}_hero_${k}`] ?? '').trim()
      const player = (row[`team_${side}_player_${k}`] ?? '').trim()
      return hero || player ? [{ player, hero }] : []
    })
  const duration = Number(row.duration ?? row.minutes ?? '')
  return {
    game: Number(row.game),
    winner: row.winner ?? '',
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    kills: pair(row, 'kills'),
    lords: pair(row, 'lords'),
    turtles: pair(row, 'turtles'),
    towers: pair(row, 'towers'),
    picks: [picks(1), picks(2)],
  }
}

const slug = (league: string) => league.replace(/\W+/g, '-').toLowerCase()

/** Every season in the results files, grouped by league and season number. */
function parseResultFiles(): Map<string, { league: string; season: number; results: SeriesResult[] }> {
  const seasons = new Map<string, { league: string; season: number; results: SeriesResult[] }>()
  for (const file of RESULT_FILES) {
    const parsed = Papa.parse<HistoryRow>(file.text, { header: true, skipEmptyLines: true })
    const perGame = parsed.meta.fields?.includes('game') ?? false
    // Per-game files repeat a series once per game; its score is the games each side won.
    const seriesOf = new Map<string, SeriesResult>()
    for (const row of parsed.data) {
      const key = `${slug(file.league)}-${row.season}`
      const entry = seasons.get(key) ?? { league: file.league, season: Number(row.season), results: [] }
      seasons.set(key, entry)
      if (perGame) {
        const id = `${key}|${row.date}|${row.team_1}|${row.team_2}`
        let series = seriesOf.get(id)
        if (!series) {
          series = { week: Number(row.week), date: row.date, teamA: row.team_1, teamB: row.team_2, mapsA: null, mapsB: null }
          seriesOf.set(id, series)
          entry.results.push(series)
        }
        if ((row.game ?? '').trim() === '') continue
        series.mapsA = (series.mapsA ?? 0) + (row.winner === row.team_1 ? 1 : 0)
        series.mapsB = (series.mapsB ?? 0) + (row.winner === row.team_2 ? 1 : 0)
        ;(series.details ??= []).push(gameDetail(row))
        continue
      }
      const match = SCORE.exec((row.score ?? '').trim())
      entry.results.push({
        week: Number(row.week),
        date: row.date,
        teamA: row.team_1,
        teamB: row.team_2,
        mapsA: match ? Number(match[1]) : null,
        mapsB: match ? Number(match[2]) : null,
      })
    }
  }
  return seasons
}

/** Every league's seasons, newest first within each league; the newest is its current one. */
export function seasonsFor(): Season[] {
  const files = parseResultFiles()
  const out: Season[] = []
  for (const league of LEAGUES) {
    const list = [...files.values()].filter((s) => s.league === league).sort((a, b) => b.season - a.season)
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
const swap = (p: [number, number] | null): [number, number] | null => (p ? [p[1], p[0]] : null)

/** The same game seen from the other team's side. */
function flip(d: GameDetail): GameDetail {
  return { ...d, kills: swap(d.kills), lords: swap(d.lords), turtles: swap(d.turtles), towers: swap(d.towers), picks: [d.picks[1], d.picks[0]] }
}

export function standings(season: Season, throughWeek: number | null, previous: Season | null): StandingRow[] {
  const inRange = season.results.filter((r) => throughWeek === null || r.week <= throughWeek)
  const rows = new Map<string, Omit<StandingRow, 'rank' | 'previousRank'>>()
  const row = (team: string) => {
    let entry = rows.get(team)
    if (!entry) {
      entry = { team, played: 0, wins: 0, losses: 0, mapsWon: 0, mapsLost: 0, w20: 0, w21: 0, l12: 0, l02: 0, games: [], remaining: 0 }
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
      a.games.push({ week: r.week, date: r.date, opponent: r.teamB, mapsFor: null, mapsAgainst: null })
      b.games.push({ week: r.week, date: r.date, opponent: r.teamA, mapsFor: null, mapsAgainst: null })
      continue
    }
    a.games.push({ week: r.week, date: r.date, opponent: r.teamB, mapsFor: r.mapsA, mapsAgainst: r.mapsB, details: r.details })
    b.games.push({ week: r.week, date: r.date, opponent: r.teamA, mapsFor: r.mapsB, mapsAgainst: r.mapsA, details: r.details?.map(flip) })
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
