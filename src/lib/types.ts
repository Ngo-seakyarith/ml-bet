/**
 * Domain model for the MLBB betting dataset.
 *
 * The CSV is the source of truth, but every derived number (profit, effective
 * odds, sweep flags) is recomputed here rather than trusted from the file, so
 * that a hand-edited row cannot silently poison the statistics. Where the CSV
 * disagrees with the recomputation we keep both and surface it on the Data page.
 */

export type Outcome = 'W' | 'L' | 'VOID'

export type Market = '2-0' | 'Over 2.5'

/** Which of the three odds columns actually backs the ROI for a row. */
export type OddsQuality = 'actual' | 'snapshot' | 'estimated' | 'none'

export type OddsGroupId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5'

export interface OddsGroup {
  id: OddsGroupId
  label: string
  /** Inclusive lower bound on Match Winner decimal odds. */
  min: number
  /** Exclusive upper bound; Infinity for G5. */
  max: number
}

/** The five groups are fixed — they are the interpretation vocabulary. */
export const ODDS_GROUPS: readonly OddsGroup[] = [
  { id: 'G1', label: 'G1 1.01-1.19', min: 1.01, max: 1.2 },
  { id: 'G2', label: 'G2 1.20-1.29', min: 1.2, max: 1.3 },
  { id: 'G3', label: 'G3 1.30-1.49', min: 1.3, max: 1.5 },
  { id: 'G4', label: 'G4 1.50-1.99', min: 1.5, max: 2.0 },
  { id: 'G5', label: 'G5 2.00+', min: 2.0, max: Number.POSITIVE_INFINITY },
]

/** Odds at or above this price mean the selected team was not the favourite. */
export const FAVOURITE_ODDS_CEILING = 2.0

export interface Bet {
  id: number
  /** Calendar weekend label, e.g. "Sep 11-13 2026". */
  week: string
  date: string
  league: string
  officialWeek: string
  selectedTeam: string
  opponent: string

  // --- Match Winner side -------------------------------------------------
  winnerOdds: number | null
  /** Derived from winnerOdds; the CSV does not carry a group column. */
  oddsGroup: OddsGroupId | null
  winnerResult: Outcome
  winnerProfit: number | null

  // --- Match facts -------------------------------------------------------
  selectedMaps: number | null
  opponentMaps: number | null
  score: string
  selectedTeamWon: boolean | null
  /** True when the match ended 2-0 in either direction. */
  matchWasSweep: boolean | null
  /** True only when OUR selected team swept 2-0. This is the 2-0 bet outcome. */
  selectedTeamSwept: boolean | null

  // --- Strategy side -----------------------------------------------------
  market: Market
  selection: string
  oddsSnapshot: number | null
  oddsActual: number | null
  oddsEstimated: number | null
  /** The price the CSV claims to have used, for cross-checking only. */
  oddsUsedInCsv: number | null
  /** actual > snapshot > estimated, recomputed here. */
  effectiveOdds: number | null
  oddsQuality: OddsQuality
  strategyResult: Outcome
  strategyProfit: number | null

  // --- Favourite / upset -------------------------------------------------
  /** Selected team was priced as favourite (winner odds < 2.00). */
  isFavourite: boolean | null
  /** Selected favourite lost — an upset against our pick. */
  isUpset: boolean | null

  // --- Provenance --------------------------------------------------------
  oddsNote: string
  notes: string
  sourceUrl: string

  /** Profit columns as they appear in the CSV, for the reconciliation view. */
  csvWinnerProfit: number | null
  csvStrategyProfit: number | null
}

/** A row the parser could not turn into a usable Bet. */
export interface RowIssue {
  recordId: string
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ParseResult {
  bets: Bet[]
  issues: RowIssue[]
}
