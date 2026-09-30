<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { bankrollSeries, drawdown, marketPerformance, summarize } from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import StatTile from '../components/ui/StatTile.vue'
import ResultBadge from '../components/ui/ResultBadge.vue'
import BankrollChart from '../components/charts/BankrollChart.vue'
import { EMPTY, odds, percent, shortDate, signedPercent, toneFor, units } from '../lib/format'

const { scoped } = useDataset()

/** Running total of every tracked pick at flat one-unit stakes. */
const series = computed(() => bankrollSeries(scoped.value))
const risk = computed(() => drawdown(series.value))
const summary = computed(() => summarize(scoped.value))
const twoZero = computed(() => marketPerformance(scoped.value, '2-0'))
const over = computed(() => marketPerformance(scoped.value, 'Over 2.5'))

const total = computed(() => series.value.at(-1)?.cumulative ?? 0)
const settled = computed(() => series.value.length)
const roi = computed(() => (settled.value === 0 ? null : total.value / settled.value))
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="stat-grid" data-cols="5">
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
      title="Running total"
      note="Every tracked pick at one unit, in the order it settled. Break-even is the zero line."
    >
      <BankrollChart :points="series" />
    </SectionCard>

    <SectionCard title="Every settled pick">
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
                Nothing has settled in this selection. Widen the weekend filter.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <SectionCard title="What the running total is made of">
      <div class="flex flex-col gap-3 px-4 py-4 text-[13px] leading-relaxed text-ink-2">
        <p class="max-w-[72ch]">
          The strategy is at
          <span class="tnum font-semibold" :class="toneFor(total) === 'good' ? 'text-good' : toneFor(total) === 'bad' ? 'text-critical' : 'text-ink'">
            {{ settled === 0 ? EMPTY : `${units(total)} units` }}
          </span>
          across {{ settled }} settled pick{{ settled === 1 ? '' : 's' }}, at one unit each.
        </p>
        <p v-if="over.n > 0" class="max-w-[72ch]">
          Of those, {{ twoZero.n }} were 2-0
          ({{ percent(twoZero.hitRate) }} hit, {{ units(twoZero.profit) }} units) and
          {{ over.n }} were Over 2.5
          ({{ percent(over.hitRate) }} hit, {{ units(over.profit) }} units). The running total
          adds them because both are bets you made a call on; the Dashboard keeps the two
          markets apart where the comparison matters.
        </p>
        <p class="max-w-[72ch] text-muted">
          This is what flat staking every tracked pick would have returned, not a record of an
          account. Staking varied in reality, so treat it as the method's result.
        </p>
      </div>
    </SectionCard>
  </div>
</template>
