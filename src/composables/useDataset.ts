import { computed, reactive, ref } from 'vue'
import { dataset } from '../lib/dataset'
import { applyMode } from '../lib/stats'
import type { AnalysisMode, Bet, BetStatus, Market, OddsGroupId } from '../lib/types'

export const ALL = 'all' as const
type All = typeof ALL

export interface MatchFilters {
  league: string | All
  oddsGroup: OddsGroupId | All
  market: Market | All
  betStatus: BetStatus | All
  winnerResult: 'W' | 'L' | All
  strategyResult: 'W' | 'L' | All
  oddsQuality: 'actual' | 'snapshot' | 'estimated' | All
  sweep: 'sweep' | 'decider' | All
  team: string
  search: string
}

function emptyFilters(): MatchFilters {
  return {
    league: ALL,
    oddsGroup: ALL,
    market: ALL,
    betStatus: ALL,
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

/** Research counts every pre-match pick; real money counts only placed bets. */
const mode = ref<AnalysisMode>('research')

/**
 * The Sep 4-6 week is a reconstructed backtest priced with interpolated 2-0
 * odds. It is opt-in so its estimated prices never quietly inflate a headline.
 */
const includeBacktest = ref(true)

/** Global weekend filter; every page respects it. */
const week = ref<string | All>(ALL)

const filters = reactive<MatchFilters>(emptyFilters())

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

  /** Mode + week applied. This is what every statistic on every page reads. */
  const scoped = computed<Bet[]>(() => {
    const byMode = applyMode(dataset.bets, mode.value, includeBacktest.value)
    return week.value === ALL ? byMode : byMode.filter((bet) => bet.week === week.value)
  })

  /** Scoped rows with the Matches page's own column filters on top. */
  const filtered = computed<Bet[]>(() => {
    const needle = filters.search.trim().toLowerCase()
    return scoped.value.filter((bet) => {
      if (filters.league !== ALL && bet.league !== filters.league) return false
      if (filters.oddsGroup !== ALL && bet.oddsGroup !== filters.oddsGroup) return false
      if (filters.market !== ALL && bet.market !== filters.market) return false
      if (filters.betStatus !== ALL && bet.betStatus !== filters.betStatus) return false
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
    mode,
    includeBacktest,
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
  }
}
