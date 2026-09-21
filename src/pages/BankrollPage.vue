<script setup lang="ts">
import { computed } from 'vue'
import { ALL, useDataset } from '../composables/useDataset'
import { bankrollSeries, drawdown, marketPerformance, summarize } from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import StatTile from '../components/ui/StatTile.vue'
import ResultBadge from '../components/ui/ResultBadge.vue'
import BankrollChart from '../components/charts/BankrollChart.vue'
import { EMPTY, odds, percent, shortDate, signedPercent, toneFor, units } from '../lib/format'

const { allBets, week } = useDataset()

/**
 * The bankroll ignores the research/real toggle on purpose. Money that was
 * never staked cannot appear here, whatever mode the rest of the app is in.
 */
const placed = computed(() => {
  const staked = allBets.value.filter((bet) => bet.betStatus === 'placed')
  return week.value === ALL ? staked : staked.filter((bet) => bet.week === week.value)
})

const series = computed(() => bankrollSeries(placed.value))
const risk = computed(() => drawdown(series.value))
const summary = computed(() => summarize(placed.value))
const twoZero = computed(() => marketPerformance(placed.value, '2-0'))
const over = computed(() => marketPerformance(placed.value, 'Over 2.5'))

const total = computed(() => series.value.at(-1)?.cumulative ?? 0)
const settled = computed(() => series.value.length)
const roi = computed(() => (settled.value === 0 ? null : total.value / settled.value))

/** What the same picks would have returned if none had been skipped. */
const researchComparison = computed(() => {
  const preMatch = allBets.value.filter(
    (bet) => bet.betStatus !== 'postponed' && bet.betStatus !== 'backtest_only',
  )
  const scoped = week.value === ALL ? preMatch : preMatch.filter((bet) => bet.week === week.value)
  return marketPerformance(scoped, '2-0')
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="grid rounded-md border border-rule bg-surface sm:grid-cols-2 lg:grid-cols-5">
      <StatTile
        label="Units staked"
        :value="String(settled)"
        support="One unit per settled bet"
      />
      <StatTile
        label="Profit"
        :value="settled === 0 ? EMPTY : units(total)"
        :support="`${settled} settled bet${settled === 1 ? '' : 's'}`"
        :tone="toneFor(total)"
      />
      <StatTile
        label="ROI"
        :value="signedPercent(roi)"
        support="Profit per unit staked"
        :tone="toneFor(roi)"
        :confidence="summary.strategy20.confidence"
        :n="settled"
      />
      <StatTile
        label="Worst drawdown"
        :value="settled === 0 ? EMPTY : `-${risk.maxDrawdown.toFixed(2)}`"
        support="Peak to trough, in units"
      />
      <StatTile
        label="Longest losing run"
        :value="settled === 0 ? EMPTY : String(risk.longestLosingStreak)"
        support="Consecutive losing bets"
      />
    </section>

    <SectionCard
      title="Real money only"
      note="Rows marked placed in the CSV. Skipped picks and the backtest week are excluded regardless of the mode toggle."
    >
      <BankrollChart :points="series" />
    </SectionCard>

    <SectionCard title="Every placed bet">
      <div class="scroll-x">
        <table class="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-rule-strong text-left">
              <th class="px-4 py-2 font-medium text-ink-2">#</th>
              <th class="px-3 py-2 font-medium text-ink-2">Date</th>
              <th class="px-3 py-2 font-medium text-ink-2">Bet</th>
              <th class="px-3 py-2 font-medium text-ink-2">Market</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Price</th>
              <th class="px-3 py-2 font-medium text-ink-2">Result</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Units</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Running</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in series" :key="point.bet.id" class="border-b border-rule last:border-b-0">
              <td class="tnum px-4 py-2 text-muted">{{ point.index }}</td>
              <td class="tnum whitespace-nowrap px-3 py-2 text-ink-2">
                {{ shortDate(point.bet.date) }}
              </td>
              <td class="px-3 py-2 font-medium text-ink">{{ point.bet.selection }}</td>
              <td class="px-3 py-2 text-ink-2">{{ point.bet.market }}</td>
              <td class="tnum px-3 py-2 text-right">
                {{ odds(point.bet.effectiveOdds) }}
                <span class="ml-1 text-[10.5px] text-muted">{{ point.bet.oddsQuality }}</span>
              </td>
              <td class="px-3 py-2"><ResultBadge :result="point.bet.strategyResult" compact /></td>
              <td
                class="tnum px-3 py-2 text-right"
                :class="point.profit > 0 ? 'text-good' : 'text-critical'"
              >
                {{ units(point.profit) }}
              </td>
              <td
                class="tnum px-3 py-2 text-right font-semibold"
                :class="point.cumulative > 0 ? 'text-good' : point.cumulative < 0 ? 'text-critical' : ''"
              >
                {{ units(point.cumulative) }}
              </td>
            </tr>
            <tr v-if="series.length === 0">
              <td colspan="8" class="px-4 py-10 text-center text-muted">
                No placed bets in this selection. Set
                <code class="text-ink-2">strategy_bet_status</code> to
                <code class="text-ink-2">placed</code> in the CSV to track one.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <SectionCard title="Account versus strategy">
      <div class="flex flex-col gap-3 px-4 py-4 text-[13px] leading-relaxed text-ink-2">
        <p class="max-w-[72ch]">
          The account is at
          <span class="tnum font-semibold" :class="toneFor(total) === 'good' ? 'text-good' : toneFor(total) === 'bad' ? 'text-critical' : 'text-ink'">
            {{ settled === 0 ? EMPTY : `${units(total)} units` }}
          </span>
          across {{ settled }} settled bet{{ settled === 1 ? '' : 's' }}. Over the same weekends
          the 2-0 strategy as researched returned
          <span class="tnum font-semibold text-ink">{{ signedPercent(researchComparison.roi) }}</span>
          over {{ researchComparison.n }} pre-match picks.
        </p>
        <p class="max-w-[72ch] text-muted">
          A gap between those two numbers is not the strategy working or failing — it is the
          effect of which bets got placed and which got talked out of. That decision is the
          thing to examine.
        </p>
        <p v-if="over.n > 0" class="max-w-[72ch] text-muted">
          Of the placed bets, {{ twoZero.n }} were 2-0
          ({{ percent(twoZero.hitRate) }} hit, {{ units(twoZero.profit) }} units) and
          {{ over.n }} were Over 2.5
          ({{ percent(over.hitRate) }} hit, {{ units(over.profit) }} units). They are counted
          together here only because both put real money at risk.
        </p>
      </div>
    </SectionCard>
  </div>
</template>
