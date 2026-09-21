import {
  ODDS_GROUPS,
  type AnalysisMode,
  type Bet,
  type Market,
  type OddsGroupId,
} from './types'

/* -------------------------------------------------------------------------
 * Core measures
 * ---------------------------------------------------------------------- */

export type Confidence = 'low' | 'moderate' | 'ok'

export interface Interval {
  low: number
  high: number
}

export interface Performance {
  /** Resolved bets only — voids never enter a rate or an ROI. */
  n: number
  wins: number
  losses: number
  hitRate: number | null
  /** One unit per resolved bet (flat staking). */
  staked: number
  profit: number
  roi: number | null
  /** Wilson score interval on the hit rate. */
  ci: Interval | null
  confidence: Confidence
}

const EMPTY_PERFORMANCE: Performance = {
  n: 0,
  wins: 0,
  losses: 0,
  hitRate: null,
  staked: 0,
  profit: 0,
  roi: null,
  ci: null,
  confidence: 'low',
}

/**
 * Wilson score interval. Preferred over the normal approximation because these
 * samples are small and the rates sit close to 1, where the naive interval
 * runs off the end of the scale.
 */
export function wilson(successes: number, total: number, z = 1.96): Interval | null {
  if (total <= 0) return null
  const p = successes / total
  const z2 = z * z
  const denominator = 1 + z2 / total
  const centre = (p + z2 / (2 * total)) / denominator
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denominator
  return { low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) }
}

/**
 * Sample-size banding. A +190% ROI off six bets must not read as being as solid
 * as +30% off a hundred, so every surface that shows a rate also shows this.
 */
export function confidenceFor(n: number): Confidence {
  if (n < 10) return 'low'
  if (n < 25) return 'moderate'
  return 'ok'
}

/** Builds a Performance from already-resolved (win/loss, price) pairs. */
function performanceFrom(entries: readonly { won: boolean; profit: number }[]): Performance {
  if (entries.length === 0) return EMPTY_PERFORMANCE
  let wins = 0
  let profit = 0
  for (const entry of entries) {
    if (entry.won) wins += 1
    profit += entry.profit
  }
  const n = entries.length
  const staked = n
  return {
    n,
    wins,
    losses: n - wins,
    hitRate: wins / n,
    staked,
    profit,
    roi: profit / staked,
    ci: wilson(wins, n),
    confidence: confidenceFor(n),
  }
}

/** Match Winner performance. Independent of which strategy market was played. */
export function winnerPerformance(bets: readonly Bet[]): Performance {
  const entries = bets
    .filter((bet) => bet.winnerResult !== 'VOID' && bet.winnerProfit !== null)
    .map((bet) => ({ won: bet.winnerResult === 'W', profit: bet.winnerProfit as number }))
  return performanceFrom(entries)
}

/**
 * Performance of one strategy market. Over 2.5 and 2-0 are never pooled —
 * they are different bets with different distributions.
 */
export function marketPerformance(bets: readonly Bet[], market: Market): Performance {
  const entries = bets
    .filter(
      (bet) =>
        bet.market === market && bet.strategyResult !== 'VOID' && bet.strategyProfit !== null,
    )
    .map((bet) => ({ won: bet.strategyResult === 'W', profit: bet.strategyProfit as number }))
  return performanceFrom(entries)
}

export interface ConditionalSweep {
  /** Denominator: matches where the selected team actually won. */
  correctWinnerPicks: number
  /** Numerator: those that finished 2-0 to the selected team. */
  sweeps: number
  rate: number | null
  ci: Interval | null
  confidence: Confidence
}

/**
 * P(2-0 | our selected team wins).
 *
 * This is the headline number: it separates "can we pick the winner" from
 * "given we picked right, how often is it a sweep", which is the only part the
 * 2-0 market actually prices.
 */
export function conditionalSweep(bets: readonly Bet[]): ConditionalSweep {
  const correct = bets.filter((bet) => bet.winnerResult === 'W' && bet.selectedTeamSwept !== null)
  const sweeps = correct.filter((bet) => bet.selectedTeamSwept === true).length
  const n = correct.length
  return {
    correctWinnerPicks: n,
    sweeps,
    rate: n === 0 ? null : sweeps / n,
    ci: wilson(sweeps, n),
    confidence: confidenceFor(n),
  }
}

export interface UpsetStats {
  /** Resolved matches where our selected team was the favourite. */
  favouriteSelections: number
  favouriteLosses: number
  rate: number | null
  confidence: Confidence
}

/** How often the market favourite we backed actually lost. */
export function upsetStats(bets: readonly Bet[]): UpsetStats {
  const favourites = bets.filter((bet) => bet.isFavourite === true && bet.winnerResult !== 'VOID')
  const losses = favourites.filter((bet) => bet.winnerResult === 'L').length
  const n = favourites.length
  return {
    favouriteSelections: n,
    favouriteLosses: losses,
    rate: n === 0 ? null : losses / n,
    confidence: confidenceFor(n),
  }
}

/** Share of resolved matches that finished 2-0 to either side. */
export function sweepRate(bets: readonly Bet[]): number | null {
  const resolved = bets.filter((bet) => bet.matchWasSweep !== null)
  if (resolved.length === 0) return null
  return resolved.filter((bet) => bet.matchWasSweep === true).length / resolved.length
}

/* -------------------------------------------------------------------------
 * Mode and filtering
 * ---------------------------------------------------------------------- */

/**
 * Research mode keeps every pre-match pick, including ones the user talked
 * themselves out of. Real-money mode keeps only settled, staked bets.
 */
export function applyMode(
  bets: readonly Bet[],
  mode: AnalysisMode,
  includeBacktest: boolean,
): Bet[] {
  if (mode === 'real') return bets.filter((bet) => bet.betStatus === 'placed')
  return bets.filter(
    (bet) =>
      bet.betStatus !== 'postponed' && (includeBacktest || bet.betStatus !== 'backtest_only'),
  )
}

/* -------------------------------------------------------------------------
 * Segmentation
 * ---------------------------------------------------------------------- */

export interface Segment {
  key: string
  label: string
  bets: Bet[]
  winner: Performance
  strategy20: Performance
  conditional: ConditionalSweep
  upsets: UpsetStats
  sweepRate: number | null
}

function buildSegment(key: string, label: string, bets: Bet[]): Segment {
  return {
    key,
    label,
    bets,
    winner: winnerPerformance(bets),
    strategy20: marketPerformance(bets, '2-0'),
    conditional: conditionalSweep(bets),
    upsets: upsetStats(bets),
    sweepRate: sweepRate(bets),
  }
}

function groupBy(bets: readonly Bet[], key: (bet: Bet) => string | null): Map<string, Bet[]> {
  const groups = new Map<string, Bet[]>()
  for (const bet of bets) {
    const value = key(bet)
    if (value === null) continue
    const bucket = groups.get(value)
    if (bucket) bucket.push(bet)
    else groups.set(value, [bet])
  }
  return groups
}

/** G1–G5, always all five in order so gaps stay visible. */
export function segmentsByOddsGroup(bets: readonly Bet[]): Segment[] {
  const groups = groupBy(bets, (bet) => bet.oddsGroup)
  return ODDS_GROUPS.map((group) =>
    buildSegment(group.id, group.label, groups.get(group.id) ?? []),
  )
}

export function segmentsByLeague(bets: readonly Bet[]): Segment[] {
  return [...groupBy(bets, (bet) => bet.league)]
    .map(([league, rows]) => buildSegment(league, league, rows))
    .sort((a, b) => b.bets.length - a.bets.length)
}

/** Chronological, using the earliest date seen in each weekend bucket. */
export function segmentsByWeek(bets: readonly Bet[]): Segment[] {
  const groups = groupBy(bets, (bet) => bet.week)
  return [...groups]
    .map(([week, rows]) => buildSegment(week, week, rows))
    .sort((a, b) => {
      const aDate = a.bets.reduce((min, bet) => (bet.date < min ? bet.date : min), '9999')
      const bDate = b.bets.reduce((min, bet) => (bet.date < min ? bet.date : min), '9999')
      return aDate.localeCompare(bDate)
    })
}

export function segmentsByTeam(bets: readonly Bet[]): Segment[] {
  return [...groupBy(bets, (bet) => bet.selectedTeam)]
    .map(([team, rows]) => buildSegment(team, team, rows))
    .sort((a, b) => b.bets.length - a.bets.length)
}

/* -------------------------------------------------------------------------
 * Bankroll
 * ---------------------------------------------------------------------- */

export interface BankrollPoint {
  index: number
  bet: Bet
  profit: number
  cumulative: number
  bankroll: number
}

/**
 * Flat one-unit staking over settled bets in date order. Voids are skipped
 * rather than counted as a push, because none of them settled.
 */
export function bankrollSeries(bets: readonly Bet[], startingBankroll = 0): BankrollPoint[] {
  const settled = bets
    .filter((bet) => bet.strategyResult !== 'VOID' && bet.strategyProfit !== null)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date)))

  let cumulative = 0
  return settled.map((bet, index) => {
    const profit = bet.strategyProfit as number
    cumulative += profit
    return {
      index: index + 1,
      bet,
      profit,
      cumulative,
      bankroll: startingBankroll + cumulative,
    }
  })
}

export interface DrawdownSummary {
  peak: number
  trough: number
  maxDrawdown: number
  longestLosingStreak: number
}

export function drawdown(points: readonly BankrollPoint[]): DrawdownSummary {
  let peak = 0
  let maxDrawdown = 0
  let trough = 0
  let streak = 0
  let longestLosingStreak = 0

  for (const point of points) {
    peak = Math.max(peak, point.cumulative)
    const dip = peak - point.cumulative
    if (dip > maxDrawdown) {
      maxDrawdown = dip
      trough = point.cumulative
    }
    if (point.profit < 0) {
      streak += 1
      longestLosingStreak = Math.max(longestLosingStreak, streak)
    } else {
      streak = 0
    }
  }
  return { peak, trough, maxDrawdown, longestLosingStreak }
}

/* -------------------------------------------------------------------------
 * Odds quality / market movement
 * ---------------------------------------------------------------------- */

export interface OddsQualityBreakdown {
  actual: number
  snapshot: number
  estimated: number
  none: number
}

export function oddsQualityBreakdown(bets: readonly Bet[]): OddsQualityBreakdown {
  const counts: OddsQualityBreakdown = { actual: 0, snapshot: 0, estimated: 0, none: 0 }
  for (const bet of bets) counts[bet.oddsQuality] += 1
  return counts
}

export interface MarketMove {
  bet: Bet
  snapshot: number
  actual: number
  /** Negative means the price shortened between the plan and the bet. */
  drift: number
  driftPct: number
}

/** Rows where we can see what the market did between planning and betting. */
export function marketMoves(bets: readonly Bet[]): MarketMove[] {
  return bets
    .filter((bet) => bet.oddsSnapshot !== null && bet.oddsActual !== null)
    .map((bet) => {
      const snapshot = bet.oddsSnapshot as number
      const actual = bet.oddsActual as number
      return {
        bet,
        snapshot,
        actual,
        drift: actual - snapshot,
        driftPct: (actual - snapshot) / snapshot,
      }
    })
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
}

/* -------------------------------------------------------------------------
 * Reconciliation against the CSV's own profit columns
 * ---------------------------------------------------------------------- */

export interface Discrepancy {
  bet: Bet
  field: 'winner_unit_profit' | 'strategy_unit_profit'
  csvValue: number | null
  computed: number | null
}

/** Flags rows where the CSV's stored profit disagrees with the recomputation. */
export function discrepancies(bets: readonly Bet[]): Discrepancy[] {
  const out: Discrepancy[] = []
  const differs = (a: number | null, b: number | null) => {
    if (a === null && b === null) return false
    if (a === null || b === null) return true
    return Math.abs(a - b) > 0.005
  }
  for (const bet of bets) {
    if (differs(bet.csvWinnerProfit, bet.winnerProfit)) {
      out.push({
        bet,
        field: 'winner_unit_profit',
        csvValue: bet.csvWinnerProfit,
        computed: bet.winnerProfit,
      })
    }
    if (differs(bet.csvStrategyProfit, bet.strategyProfit)) {
      out.push({
        bet,
        field: 'strategy_unit_profit',
        csvValue: bet.csvStrategyProfit,
        computed: bet.strategyProfit,
      })
    }
  }
  return out
}

/* -------------------------------------------------------------------------
 * Team scatter input
 * ---------------------------------------------------------------------- */

/**
 * One row per selected team: how the market priced them against how often
 * backing them produced a sweep. Rows keep their Bet[] so chart callbacks can
 * hand back the underlying matches.
 */
export interface TeamPoint {
  team: string
  league: string
  picks: number
  averageWinnerOdds: number
  winnerHitRate: number | null
  conditionalSweepRate: number | null
  correctWinnerPicks: number
  sweeps: number
  strategyRoi: number | null
  bets: Bet[]
}

export function teamPoints(bets: readonly Bet[], minimumPicks = 1): TeamPoint[] {
  const groups = groupBy(bets, (bet) => bet.selectedTeam)
  const points: TeamPoint[] = []

  for (const [team, rows] of groups) {
    const priced = rows.filter((bet) => bet.winnerOdds !== null)
    if (priced.length < minimumPicks) continue

    const conditional = conditionalSweep(rows)
    const winner = winnerPerformance(rows)
    const strategy = marketPerformance(rows, '2-0')
    const averageWinnerOdds =
      priced.reduce((sum, bet) => sum + (bet.winnerOdds as number), 0) / priced.length

    // The league a team plays in; teams do not cross leagues in this dataset.
    const league = rows[0]?.league ?? ''

    points.push({
      team,
      league,
      picks: priced.length,
      averageWinnerOdds,
      winnerHitRate: winner.hitRate,
      conditionalSweepRate: conditional.rate,
      correctWinnerPicks: conditional.correctWinnerPicks,
      sweeps: conditional.sweeps,
      strategyRoi: strategy.roi,
      bets: rows,
    })
  }

  return points.sort((a, b) => b.picks - a.picks)
}

/* -------------------------------------------------------------------------
 * Headline summary
 * ---------------------------------------------------------------------- */

export interface Summary {
  totalMatches: number
  weeks: number
  leagues: number
  winner: Performance
  strategy20: Performance
  over25: Performance
  conditional: ConditionalSweep
  upsets: UpsetStats
}

export function summarize(bets: readonly Bet[]): Summary {
  return {
    totalMatches: bets.length,
    weeks: new Set(bets.map((bet) => bet.week)).size,
    leagues: new Set(bets.map((bet) => bet.league)).size,
    winner: winnerPerformance(bets),
    strategy20: marketPerformance(bets, '2-0'),
    over25: marketPerformance(bets, 'Over 2.5'),
    conditional: conditionalSweep(bets),
    upsets: upsetStats(bets),
  }
}

export type { AnalysisMode, Bet, Market, OddsGroupId }
