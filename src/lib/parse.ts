import Papa from 'papaparse'
import { z } from 'zod'
import {
  FAVOURITE_ODDS_CEILING,
  ODDS_GROUPS,
  type Bet,
  type Market,
  type OddsGroupId,
  type OddsQuality,
  type Outcome,
  type ParseResult,
  type RowIssue,
} from './types'

/** Empty strings in the CSV mean "not applicable", not zero. */
const blankToNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const numericish = z
  .unknown()
  .transform(blankToNull)
  .transform((value, ctx) => {
    if (value === null) return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: 'custom', message: `"${value}" is not a number` })
      return null
    }
    return parsed
  })

const text = z.unknown().transform((value) => blankToNull(value) ?? '')

/**
 * The single strategy price column. "2.52" is a price actually seen on the
 * bookmaker; "~2.52" is an estimate (the backtest week, or an approximate
 * price). Blank means no price yet.
 */
const price = z
  .unknown()
  .transform(blankToNull)
  .transform((value, ctx): { odds: number | null; quality: OddsQuality } => {
    if (value === null) return { odds: null, quality: 'none' }
    const estimated = value.startsWith('~')
    const parsed = Number(estimated ? value.slice(1).trim() : value)
    if (!Number.isFinite(parsed) || parsed <= 1) {
      ctx.addIssue({ code: 'custom', message: `"${value}" is not a price like 2.10 or ~2.10` })
      return { odds: null, quality: 'none' }
    }
    return { odds: parsed, quality: estimated ? 'estimated' : 'observed' }
  })

const rowSchema = z.object({
  record_id: numericish,
  calendar_week: text,
  date: text,
  league: text,
  official_week: text,
  selected_team: text,
  opponent: text,
  selected_match_winner_odds: numericish,
  opponent_match_winner_odds: numericish,
  correct_score_2_0_odds: price,
  correct_score_2_1_odds: price,
  correct_score_1_2_odds: price,
  correct_score_0_2_odds: price,
  total_maps_over_2_5_odds: price,
  total_maps_under_2_5_odds: price,
  selected_plus_1_5_odds: price,
  opponent_plus_1_5_odds: price,
  score: text,
  bet: text,
  notes: text,
})

type RawRow = z.infer<typeof rowSchema>

const MARKETS: readonly Market[] = ['2-0', '2-1', '1-2', '0-2', 'Over 2.5', 'Under 2.5', '+1.5', 'Win']

/** The bet column's value as a Market, or null if blank or unrecognised. */
function toMarket(raw: string): Market | null {
  const value = raw.trim()
  return (MARKETS as readonly string[]).includes(value) ? (value as Market) : null
}

/**
 * Maps a Match Winner price onto its G1–G5 bucket. The group is always derived
 * here; the CSV does not store it.
 */
function toOddsGroup(odds: number | null): OddsGroupId | null {
  if (odds === null) return null
  const group = ODDS_GROUPS.find((g) => odds >= g.min && odds < g.max)
  return group?.id ?? null
}

const SCORE = /^(\d+)-(\d+)$/

/**
 * Reads the series score from the selected team's side ("2-1" means our pick
 * won two maps to one). Blank means not played yet. Returns null maps for
 * blank or unreadable scores; the caller reports unreadable ones.
 */
function parseScore(raw: string): { selected: number; opponent: number } | null {
  const match = SCORE.exec(raw.replace(/\s+/g, ''))
  if (!match) return null
  return { selected: Number(match[1]), opponent: Number(match[2]) }
}

/**
 * Settles one bet type from the score, read from the backed team's side
 * (`team` maps first). Total-maps bets ignore which side is first.
 */
export function settle(market: Market, s: { team: number; other: number }): boolean {
  switch (market) {
    case 'Over 2.5':
      return s.team + s.other === 3
    case 'Under 2.5':
      return s.team + s.other === 2
    case '+1.5':
      // Wins unless the team is swept 0-2.
      return s.team >= 1
    case 'Win':
      return s.team > s.other
    default:
      return `${s.team}-${s.other}` === market
  }
}

/** Display label, e.g. "DEWA United 2-1", "Over 2.5", "RRQ Hoshi to win". */
export function selectionLabel(market: Market, team: string): string {
  if (market === 'Over 2.5' || market === 'Under 2.5') return market
  if (market === 'Win') return `${team} to win`
  return `${team} ${market}`
}

/** Flat-stake profit on one unit. A void bet returns the stake, not a result. */
function unitProfit(result: Outcome, odds: number | null): number | null {
  if (result === 'VOID' || odds === null) return null
  return result === 'W' ? odds - 1 : -1
}

function normalize(row: RawRow, issues: RowIssue[]): Bet {
  const recordId = row.record_id === null ? '?' : String(row.record_id)
  const push = (field: string, message: string, severity: RowIssue['severity'] = 'error') =>
    issues.push({ recordId, field, message, severity })

  // The bet's price is the matching market column: no separate strategy price.
  // A row with no bet is a fixture, not a bet, so it has no price.
  const market = toMarket(row.bet)
  if (row.bet !== '' && market === null) {
    push('bet', `"${row.bet}" is not a bet type; use 2-0, 2-1, 1-2, 0-2, Over 2.5, Under 2.5, +1.5 or Win`)
  }
  const winPrice = row.selected_match_winner_odds
  const PRICE_COLUMN: Record<Market, RawRow['correct_score_2_0_odds']> = {
    '2-0': row.correct_score_2_0_odds,
    '2-1': row.correct_score_2_1_odds,
    '1-2': row.correct_score_1_2_odds,
    '0-2': row.correct_score_0_2_odds,
    'Over 2.5': row.total_maps_over_2_5_odds,
    'Under 2.5': row.total_maps_under_2_5_odds,
    '+1.5': row.selected_plus_1_5_odds,
    Win: { odds: winPrice, quality: winPrice === null ? 'none' : 'observed' },
  }
  const { odds: effectiveOdds, quality: oddsQuality } =
    market === null ? { odds: null, quality: 'none' as const } : PRICE_COLUMN[market]
  // A bet needs its price. A missing +1.5 means the line was not offered (a
  // heavy favourite gets none), so it is never estimated: it is an error.
  if (market === '+1.5' && effectiveOdds === null) {
    push('bet', 'a +1.5 bet but selected_plus_1_5_odds is blank; that line is not offered for this team')
  } else if (market !== null && effectiveOdds === null) {
    push('bet', `a ${market} bet but its price column is blank`, 'warning')
  }

  const oddsGroup = toOddsGroup(row.selected_match_winner_odds)

  // A real two-way market adds up to a little over 1 (the bookmaker's margin,
  // ~7-8% on Thunderpick). Far outside that is almost always a typo.
  if (row.selected_match_winner_odds !== null && row.opponent_match_winner_odds !== null) {
    const book = 1 / row.selected_match_winner_odds + 1 / row.opponent_match_winner_odds
    if (book < 1.0 || book > 1.15) {
      push(
        'opponent_match_winner_odds',
        `${row.selected_match_winner_odds} and ${row.opponent_match_winner_odds} imply a ${((book - 1) * 100).toFixed(0)}% margin; check for a typo`,
        'warning',
      )
    }
  }

  // Everything about how the series went is derived from the one score column.
  const maps = parseScore(row.score)
  if (maps === null && row.score !== '') {
    push('score', `"${row.score}" is not a score like 2-0 or 1-2; leave it blank if not played`)
  }
  const selectedTeamWon = maps === null ? null : maps.selected > maps.opponent
  // A 2-0 either way; used for league sweep rates.
  const matchWasSweep =
    maps === null ? null : Math.max(maps.selected, maps.opponent) === 2 && Math.min(maps.selected, maps.opponent) === 0
  // Our 2-0 bet wins only when OUR team sweeps, not when either side does.
  const selectedTeamSwept = maps === null ? null : maps.selected === 2 && maps.opponent === 0

  // Both results come from the score. No score (not played, or postponed)
  // means unresolved, which keeps the row out of every rate and return.
  const winnerResult: Outcome = selectedTeamWon === null ? 'VOID' : selectedTeamWon ? 'W' : 'L'
  const strategyWon =
    maps === null || market === null ? null : settle(market, { team: maps.selected, other: maps.opponent })
  const strategyResult: Outcome = strategyWon === null ? 'VOID' : strategyWon ? 'W' : 'L'

  const winnerProfit = unitProfit(winnerResult, row.selected_match_winner_odds)
  const strategyProfit = unitProfit(strategyResult, effectiveOdds)

  const isFavourite = row.selected_match_winner_odds === null ? null : row.selected_match_winner_odds < FAVOURITE_ODDS_CEILING

  return {
    id: row.record_id ?? 0,
    week: row.calendar_week,
    date: row.date,
    league: row.league,
    officialWeek: row.official_week,
    selectedTeam: row.selected_team,
    opponent: row.opponent,

    winnerOdds: row.selected_match_winner_odds,
    opponentOdds: row.opponent_match_winner_odds,
    marketOdds: {
      correctScore20: row.correct_score_2_0_odds,
      correctScore21: row.correct_score_2_1_odds,
      correctScore12: row.correct_score_1_2_odds,
      correctScore02: row.correct_score_0_2_odds,
      over25: row.total_maps_over_2_5_odds,
      under25: row.total_maps_under_2_5_odds,
      selectedPlus15: row.selected_plus_1_5_odds,
      opponentPlus15: row.opponent_plus_1_5_odds,
    },
    oddsGroup,
    winnerResult,
    winnerProfit,

    selectedMaps: maps?.selected ?? null,
    opponentMaps: maps?.opponent ?? null,
    score: row.score,
    selectedTeamWon,
    matchWasSweep,
    selectedTeamSwept,

    market,
    selection: market === null ? '' : selectionLabel(market, row.selected_team),
    effectiveOdds,
    oddsQuality,
    strategyResult,
    strategyProfit,

    isFavourite,
    isUpset: isFavourite === null || winnerResult === 'VOID' ? null : isFavourite && winnerResult === 'L',

    notes: row.notes,
  }
}

export function parseDataset(source: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(source, {
    header: true,
    skipEmptyLines: true,
  })

  const issues: RowIssue[] = parsed.errors.map((error) => ({
    recordId: error.row === undefined ? '?' : String(error.row + 1),
    field: 'csv',
    message: error.message,
    severity: 'error' as const,
  }))

  const bets: Bet[] = []
  for (const raw of parsed.data) {
    // Read older CSVs too; explicit new columns take precedence, including blanks.
    const result = rowSchema.safeParse({
      ...Object.fromEntries(Object.keys(rowSchema.shape).map((field) => [field, ''])),
      ...raw,
      selected_match_winner_odds: raw.selected_match_winner_odds ?? raw.winner_odds ?? '',
      opponent_match_winner_odds: raw.opponent_match_winner_odds ?? raw.opponent_odds ?? '',
    })
    if (!result.success) {
      const recordId = raw.record_id ?? '?'
      for (const issue of result.error.issues) {
        issues.push({
          recordId,
          field: issue.path.join('.') || 'row',
          message: issue.message,
          severity: 'error',
        })
      }
      continue
    }
    bets.push(normalize(result.data, issues))
  }

  bets.sort((a, b) => (a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date)))
  return { bets, issues }
}
