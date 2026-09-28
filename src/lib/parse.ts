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
 * Accepts the CSV's 1/0 flag columns. Anything else is a data error rather
 * than a silent false.
 */
const flag = z
  .unknown()
  .transform(blankToNull)
  .transform((value, ctx) => {
    if (value === null) return null
    if (value === '1') return true
    if (value === '0') return false
    ctx.addIssue({ code: 'custom', message: `"${value}" is not 1, 0 or blank` })
    return null
  })

const rowSchema = z.object({
  record_id: numericish,
  calendar_week: text,
  date: text,
  league: text,
  official_week: text,
  selected_team: text,
  opponent: text,
  winner_odds: numericish,
  winner_pick_result: text,
  selected_maps: numericish,
  opponent_maps: numericish,
  final_score_selected_perspective: text,
  selected_team_won: flag,
  match_was_2_0_sweep: flag,
  sweep_given_selected_team_win: flag,
  strategy_market: text,
  strategy_selection: text,
  strategy_odds_snapshot: numericish,
  strategy_odds_actual: numericish,
  strategy_odds_estimated: numericish,
  strategy_odds_used_for_analysis: numericish,
  strategy_result: text,
  winner_unit_profit: numericish,
  strategy_unit_profit: numericish,
  odds_note: text,
  notes: text,
  result_source_url: text,
})

type RawRow = z.infer<typeof rowSchema>

function toOutcome(raw: string): Outcome {
  const value = raw.toUpperCase()
  if (value === 'W') return 'W'
  if (value === 'L') return 'L'
  return 'VOID'
}

function toMarket(raw: string): Market {
  return raw.trim() === 'Over 2.5' ? 'Over 2.5' : '2-0'
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

/** actual > snapshot > estimated. Returns the price and where it came from. */
function resolveOdds(row: RawRow): { odds: number | null; quality: OddsQuality } {
  if (row.strategy_odds_actual !== null)
    return { odds: row.strategy_odds_actual, quality: 'actual' }
  if (row.strategy_odds_snapshot !== null)
    return { odds: row.strategy_odds_snapshot, quality: 'snapshot' }
  if (row.strategy_odds_estimated !== null)
    return { odds: row.strategy_odds_estimated, quality: 'estimated' }
  return { odds: null, quality: 'none' }
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

  const winnerResult = toOutcome(row.winner_pick_result)
  const strategyResult = toOutcome(row.strategy_result)
  const { odds: effectiveOdds, quality: oddsQuality } = resolveOdds(row)

  const oddsGroup = toOddsGroup(row.winner_odds)

  // Our 2-0 bet wins only when OUR team sweeps, not when either side does.
  const selectedTeamSwept =
    row.selected_maps === null || row.opponent_maps === null
      ? null
      : row.selected_maps === 2 && row.opponent_maps === 0

  const winnerProfit = unitProfit(winnerResult, row.winner_odds)
  const strategyProfit = unitProfit(strategyResult, effectiveOdds)

  if (row.strategy_odds_used_for_analysis !== null && effectiveOdds !== null) {
    const drift = Math.abs(row.strategy_odds_used_for_analysis - effectiveOdds)
    if (drift > 0.005) {
      push(
        'strategy_odds_used_for_analysis',
        `CSV used ${row.strategy_odds_used_for_analysis} but actual>snapshot>estimated gives ${effectiveOdds}`,
        'warning',
      )
    }
  }

  const isFavourite = row.winner_odds === null ? null : row.winner_odds < FAVOURITE_ODDS_CEILING

  return {
    id: row.record_id ?? 0,
    week: row.calendar_week,
    date: row.date,
    league: row.league,
    officialWeek: row.official_week,
    selectedTeam: row.selected_team,
    opponent: row.opponent,

    winnerOdds: row.winner_odds,
    oddsGroup,
    winnerResult,
    winnerProfit,

    selectedMaps: row.selected_maps,
    opponentMaps: row.opponent_maps,
    score: row.final_score_selected_perspective,
    selectedTeamWon: row.selected_team_won,
    matchWasSweep: row.match_was_2_0_sweep,
    selectedTeamSwept,

    market: toMarket(row.strategy_market),
    selection: row.strategy_selection,
    oddsSnapshot: row.strategy_odds_snapshot,
    oddsActual: row.strategy_odds_actual,
    oddsEstimated: row.strategy_odds_estimated,
    oddsUsedInCsv: row.strategy_odds_used_for_analysis,
    effectiveOdds,
    oddsQuality,
    strategyResult,
    strategyProfit,

    isFavourite,
    isUpset: isFavourite === null || winnerResult === 'VOID' ? null : isFavourite && winnerResult === 'L',

    oddsNote: row.odds_note,
    notes: row.notes,
    sourceUrl: row.result_source_url,

    csvWinnerProfit: row.winner_unit_profit,
    csvStrategyProfit: row.strategy_unit_profit,
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
    const result = rowSchema.safeParse(raw)
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
