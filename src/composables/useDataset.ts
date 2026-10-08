import { computed, reactive, ref, watch } from 'vue'
import { dataset } from '../lib/dataset'
import { measureMargins, selectBets } from '../lib/stats'
import { applyStrategy, strategiesFor, strategyStats, type StrategyContext } from '../lib/strategies'
import type { Bet, Market, OddsGroupId } from '../lib/types'

export const ALL = 'all' as const
type All = typeof ALL

export interface MatchFilters {
  league: string | All
  oddsGroup: OddsGroupId | All
  market: Market | All
  winnerResult: 'W' | 'L' | All
  strategyResult: 'W' | 'L' | All
  oddsQuality: 'observed' | 'estimated' | All
  sweep: 'sweep' | 'decider' | All
  team: string
  search: string
}

function emptyFilters(): MatchFilters {
  return {
    league: ALL,
    oddsGroup: ALL,
    market: ALL,
    winnerResult: ALL,
    strategyResult: ALL,
    oddsQuality: ALL,
    sweep: ALL,
    team: ALL,
    search: '',
  }
}

/* -------------------------------------------------------------------------
 * Global state — shared by every page
 * ---------------------------------------------------------------------- */

/**
 * Rows whose 2-0 price was estimated rather than observed — the reconstructed
 * Sep 4-6 backtest plus any later "~" prices. Toggleable so estimated prices
 * never quietly inflate a headline.
 */
const includeEstimatedPrices = ref(true)

/** Global weekend filter; every page respects it. */
const week = ref<string | All>(ALL)

const filters = reactive<MatchFilters>(emptyFilters())

/**
 * The strategy every return on every page is measured for. Remembered per
 * browser as a convenience only; an unknown id falls back to your bets.
 */
const STRATEGY_KEY = 'mlbb-strategy'
function readStoredStrategy(): string {
  try {
    return localStorage.getItem(STRATEGY_KEY) ?? 'mine'
  } catch {
    return 'mine'
  }
}
const strategyId = ref(readStoredStrategy())
watch(strategyId, (id) => {
  try {
    localStorage.setItem(STRATEGY_KEY, id)
  } catch {
    // Private windows can refuse storage; the choice just will not persist.
  }
})

export function useDataset() {
  const allBets = computed<Bet[]>(() => dataset.bets)
  const issues = computed(() => dataset.issues)

  const weeks = computed(() => {
    const seen = new Map<string, string>()
    for (const bet of dataset.bets) {
      const earliest = seen.get(bet.week)
      if (earliest === undefined || bet.date < earliest) seen.set(bet.week, bet.date)
    }
    return [...seen.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([label]) => label)
  })

  const leagues = computed(() =>
    [...new Set(dataset.bets.map((bet) => bet.league))].sort((a, b) => a.localeCompare(b)),
  )

  const teams = computed(() =>
    [...new Set(dataset.bets.map((bet) => bet.selectedTeam))].sort((a, b) => a.localeCompare(b)),
  )

  /** Week applied, unplayed rows dropped. Every statistic on every page reads this. */
  const scoped = computed<Bet[]>(() => {
    const selected = selectBets(dataset.bets)
    return week.value === ALL ? selected : selected.filter((bet) => bet.week === week.value)
  })

  /** Scoped rows with the Matches page's own column filters on top. */
  const filtered = computed<Bet[]>(() => {
    const needle = filters.search.trim().toLowerCase()
    return scoped.value.filter((bet) => {
      if (filters.league !== ALL && bet.league !== filters.league) return false
      if (filters.oddsGroup !== ALL && bet.oddsGroup !== filters.oddsGroup) return false
      if (filters.market !== ALL && bet.market !== filters.market) return false
      if (filters.winnerResult !== ALL && bet.winnerResult !== filters.winnerResult) return false
      if (filters.strategyResult !== ALL && bet.strategyResult !== filters.strategyResult) return false
      if (filters.oddsQuality !== ALL && bet.oddsQuality !== filters.oddsQuality) return false
      if (filters.team !== ALL && bet.selectedTeam !== filters.team) return false
      if (filters.sweep === 'sweep' && bet.matchWasSweep !== true) return false
      if (filters.sweep === 'decider' && bet.matchWasSweep !== false) return false
      if (needle !== '') {
        const haystack =
          `${bet.selectedTeam} ${bet.opponent} ${bet.league} ${bet.selection} ${bet.notes}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  })

  /** Every strategy that can be measured on this dataset. */
  const strategies = computed(() => strategiesFor(dataset.bets))

  /** The selected strategy, falling back to your bets if the stored id is gone. */
  const strategy = computed(
    () => strategies.value.find((s) => s.id === strategyId.value) ?? strategies.value[0]!,
  )

  /** Margins are measured from every recorded pair, not just the scoped rows. */
  const strategyContext = computed<StrategyContext>(() => {
    const margins = measureMargins(dataset.bets)
    return {
      includeEstimated: includeEstimatedPrices.value,
      margin: (league) => margins(league).margin,
    }
  })

  /** Measures the selected strategy on any set of rows (a league, a weekend...). */
  const measure = computed(
    () => (rows: readonly Bet[]) => strategyStats(applyStrategy(rows, strategy.value.id, strategyContext.value)),
  )

  /** The selected strategy's settled bets on the scoped rows. */
  const strategyBets = computed(() => applyStrategy(scoped.value, strategy.value.id, strategyContext.value))

  const activeFilterCount = computed(() => {
    const defaults = emptyFilters()
    return (Object.keys(defaults) as (keyof MatchFilters)[]).filter(
      (key) => filters[key] !== defaults[key],
    ).length
  })

  function resetFilters() {
    Object.assign(filters, emptyFilters())
  }

  return {
    includeEstimatedPrices,
    week,
    filters,
    allBets,
    issues,
    weeks,
    leagues,
    teams,
    scoped,
    filtered,
    activeFilterCount,
    resetFilters,
    strategies,
    strategyId,
    strategy,
    strategyContext,
    measure,
    strategyBets,
  }
}
