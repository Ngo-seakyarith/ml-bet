import { selectionLabel, settle } from './parse'
import { otherSideOdds, performanceFrom, type Performance } from './stats'
import type { Bet, Market, MarketPrice } from './types'

/**
 * A strategy is a rule that turns one match row into (at most) one bet:
 * "the bets you actually placed", or a what-if such as "Under 2.5 on every
 * match". Every table that shows a return shows it for one strategy, so a new
 * bet type never needs a new page.
 *
 * What-ifs only use prices that are in the CSV. A blank price means the bet
 * was not offered (a heavy favourite has no +1.5), so that match is left out,
 * never estimated. The one exception is the other side of the Match Winner
 * market, which is always offered: when it was not recorded it is worked out
 * from the measured margin and flagged as estimated.
 */
export interface Strategy {
  id: string
  group: StrategyGroup
  /** Full name, e.g. "Underdog 2-1". */
  label: string
  /** One plain sentence on what it bets. */
  describe: string
}

export type StrategyGroup = 'Your bets' | 'Your pick' | 'Favourite' | 'Underdog' | 'Total maps'

/** Group headings, in display order, with the "every match" wording. */
export const GROUPS: readonly { id: StrategyGroup; heading: string }[] = [
  { id: 'Your bets', heading: 'Your bets' },
  { id: 'Your pick', heading: 'Your pick, every match' },
  { id: 'Favourite', heading: 'Favourite, every match' },
  { id: 'Underdog', heading: 'Underdog, every match' },
  { id: 'Total maps', heading: 'Total maps, every match' },
]

/** One settled bet placed by a strategy. */
export interface StrategyBet {
  bet: Bet
  market: Market
  team: string
  selection: string
  odds: number
  estimated: boolean
  won: boolean
  profit: number
}

export interface StrategyContext {
  /** False drops every bet whose price is estimated (written with ~). */
  includeEstimated: boolean
  /** Bookmaker margin per league (1/a + 1/b), for the unrecorded Match Winner side. */
  margin: (league: string) => number
}

const TEAM_MARKETS: readonly Market[] = ['Win', '2-0', '2-1', '+1.5']

const DESCRIBE: Record<string, string> = {
  Win: 'to win the match',
  '2-0': 'to win 2-0',
  '2-1': 'to win 2-1',
  '+1.5': '+1.5 maps (wins unless swept 0-2)',
}

/** Every strategy, in display order. "Your bets" only lists bet types you have used. */
export function strategiesFor(bets: readonly Bet[]): Strategy[] {
  const used = new Set(bets.map((bet) => bet.market).filter((m): m is Market => m !== null))
  const MARKET_ORDER: readonly Market[] = ['Win', '2-0', '2-1', '1-2', '0-2', '+1.5', 'Over 2.5', 'Under 2.5']
  const list: Strategy[] = [
    { id: 'mine', group: 'Your bets', label: 'All your bets', describe: 'Every bet in the bet column, all types together.' },
    ...MARKET_ORDER.filter((m) => used.has(m)).map<Strategy>((m) => ({
      id: `mine:${m}`,
      group: 'Your bets',
      label: `Your ${m} bets`,
      describe: `Only the rows where the bet column says ${m}.`,
    })),
  ]
  const sides = [
    ['pick', 'Your pick', 'Your pick', 'your selected team'],
    ['fav', 'Favourite', 'Favourite', 'the favourite'],
    ['dog', 'Underdog', 'Underdog', 'the underdog'],
  ] as const
  for (const [prefix, group, name, who] of sides) {
    for (const m of TEAM_MARKETS) {
      list.push({
        id: `${prefix}:${m}`,
        group,
        label: m === 'Win' ? `${name} to win` : `${name} ${m}`,
        describe: `Back ${who} ${DESCRIBE[m]} in every finished match with that price.`,
      })
    }
  }
  list.push(
    { id: 'total:Over 2.5', group: 'Total maps', label: 'Over 2.5', describe: 'Back three maps in every finished match.' },
    { id: 'total:Under 2.5', group: 'Total maps', label: 'Under 2.5', describe: 'Back a 2-0 either way in every finished match.' },
  )
  return list
}

/** One team's view of a match: its maps first, and its prices. */
function teamSide(bet: Bet, selected: boolean, ctx: StrategyContext) {
  const m = bet.marketOdds
  let win: MarketPrice
  if (selected) win = { odds: bet.winnerOdds, quality: bet.winnerOdds === null ? 'none' : 'observed' }
  else if (bet.opponentOdds !== null) win = { odds: bet.opponentOdds, quality: 'observed' }
  else {
    const odds = bet.winnerOdds === null ? null : otherSideOdds(bet.winnerOdds, ctx.margin(bet.league))
    win = { odds, quality: odds === null ? 'none' : 'estimated' }
  }
  const price: Partial<Record<Market, MarketPrice>> = selected
    ? { Win: win, '2-0': m.correctScore20, '2-1': m.correctScore21, '+1.5': m.selectedPlus15 }
    : { Win: win, '2-0': m.correctScore02, '2-1': m.correctScore12, '+1.5': m.opponentPlus15 }
  return {
    team: selected ? bet.selectedTeam : bet.opponent,
    maps: selected
      ? { team: bet.selectedMaps as number, other: bet.opponentMaps as number }
      : { team: bet.opponentMaps as number, other: bet.selectedMaps as number },
    price,
  }
}

/** Is the selected team the favourite? Uses the recorded or margin-derived other side. */
function selectedIsFavourite(bet: Bet, ctx: StrategyContext): boolean | null {
  if (bet.winnerOdds === null) return null
  const theirs = bet.opponentOdds ?? otherSideOdds(bet.winnerOdds, ctx.margin(bet.league))
  return theirs === null ? true : bet.winnerOdds <= theirs
}

function placed(bet: Bet, market: Market, team: string, price: MarketPrice, won: boolean, ctx: StrategyContext): StrategyBet | null {
  if (price.odds === null) return null
  const estimated = price.quality === 'estimated'
  if (estimated && !ctx.includeEstimated) return null
  return {
    bet,
    market,
    team,
    selection: selectionLabel(market, team),
    odds: price.odds,
    estimated,
    won,
    profit: won ? price.odds - 1 : -1,
  }
}

/** The settled bets a strategy would have placed, in date order. */
export function applyStrategy(bets: readonly Bet[], id: string, ctx: StrategyContext): StrategyBet[] {
  const [kind, rawMarket] = id.split(':') as [string, Market | undefined]
  const out: StrategyBet[] = []
  for (const bet of bets) {
    if (bet.selectedMaps === null || bet.opponentMaps === null) continue
    let result: StrategyBet | null = null

    if (kind === 'mine') {
      if (bet.market === null || bet.effectiveOdds === null) continue
      if (rawMarket !== undefined && bet.market !== rawMarket) continue
      result = placed(
        bet,
        bet.market,
        bet.selectedTeam,
        { odds: bet.effectiveOdds, quality: bet.oddsQuality },
        bet.strategyResult === 'W',
        ctx,
      )
    } else if (kind === 'total' && rawMarket !== undefined) {
      const price = rawMarket === 'Over 2.5' ? bet.marketOdds.over25 : bet.marketOdds.under25
      const won = settle(rawMarket, { team: bet.selectedMaps, other: bet.opponentMaps })
      result = placed(bet, rawMarket, '', price, won, ctx)
    } else if (rawMarket !== undefined) {
      let selected = true
      if (kind !== 'pick') {
        const fav = selectedIsFavourite(bet, ctx)
        if (fav === null) continue
        selected = kind === 'fav' ? fav : !fav
      }
      const side = teamSide(bet, selected, ctx)
      const price = side.price[rawMarket] ?? { odds: null, quality: 'none' }
      result = placed(bet, rawMarket, side.team, price, settle(rawMarket, side.maps), ctx)
    }
    if (result) out.push(result)
  }
  return out.sort((a, b) => (a.bet.date === b.bet.date ? a.bet.id - b.bet.id : a.bet.date.localeCompare(b.bet.date)))
}

export interface StrategyStats extends Performance {
  averageOdds: number | null
  /** Hit rate needed to break even at these prices: 1 / average price. */
  breakEven: number | null
  /** Bets whose price was estimated (~ or margin-derived). */
  estimated: number
  /** Weekends with a profit, out of weekends with at least one bet. */
  weekendsUp: number
  weekends: number
}

export function strategyStats(list: readonly StrategyBet[]): StrategyStats {
  const base = performanceFrom(list.map((item) => ({ won: item.won, profit: item.profit })))
  const n = list.length
  const averageOdds = n === 0 ? null : list.reduce((sum, item) => sum + item.odds, 0) / n
  const byWeek = new Map<string, number>()
  for (const item of list) byWeek.set(item.bet.week, (byWeek.get(item.bet.week) ?? 0) + item.profit)
  return {
    ...base,
    averageOdds,
    breakEven: averageOdds === null ? null : 1 / averageOdds,
    estimated: list.filter((item) => item.estimated).length,
    weekendsUp: [...byWeek.values()].filter((profit) => profit > 0).length,
    weekends: byWeek.size,
  }
}

/** Splits a strategy's bets by any key, keeping first-seen order. */
export function splitBy(list: readonly StrategyBet[], key: (item: StrategyBet) => string) {
  const groups = new Map<string, StrategyBet[]>()
  for (const item of list) {
    const k = key(item)
    const bucket = groups.get(k)
    if (bucket) bucket.push(item)
    else groups.set(k, [item])
  }
  return [...groups].map(([label, items]) => ({ label, items, stats: strategyStats(items) }))
}
