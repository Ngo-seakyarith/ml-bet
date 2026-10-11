import Papa from 'papaparse'
import playoffsText from '../data/MPL_Playoffs.csv?raw'

/**
 * Past playoff series, one row each: league, season, round, date, the two
 * teams and the score from team_1's side ("3-2"). Bo5, with Bo7 for the lower
 * bracket final and grand final.
 */
export interface PlayoffSeries {
  league: string
  season: number
  round: PlayoffRound
  date: string
  teamA: string
  teamB: string
  mapsA: number
  mapsB: number
}

export const ROUNDS = [
  'Play-in',
  'Upper Bracket Semifinal',
  'Upper Bracket Final',
  'Lower Bracket Semifinal',
  'Lower Bracket Final',
  'Grand Final',
] as const

export type PlayoffRound = (typeof ROUNDS)[number]

interface PlayoffRow {
  league: string
  season: string
  round: string
  date: string
  team_1: string
  team_2: string
  score: string
}

const SCORE = /^(\d+)-(\d+)$/

export const playoffSeries: readonly PlayoffSeries[] = Papa.parse<PlayoffRow>(playoffsText, {
  header: true,
  skipEmptyLines: true,
})
  .data.filter((row) => (ROUNDS as readonly string[]).includes(row.round) && SCORE.test(row.score.trim()))
  .map((row) => {
    const [, a, b] = SCORE.exec(row.score.trim())!
    return {
      league: row.league,
      season: Number(row.season),
      round: row.round as PlayoffRound,
      date: row.date,
      teamA: row.team_1,
      teamB: row.team_2,
      mapsA: Number(a),
      mapsB: Number(b),
    }
  })

export function winnerOf(series: PlayoffSeries): string {
  return series.mapsA > series.mapsB ? series.teamA : series.teamB
}
