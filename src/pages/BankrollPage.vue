<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { bankrollSeries, confidenceFor, drawdown } from '../lib/stats'
import { splitBy } from '../lib/strategies'
import SectionCard from '../components/ui/SectionCard.vue'
import StatTile from '../components/ui/StatTile.vue'
import ResultBadge from '../components/ui/ResultBadge.vue'
import BankrollChart from '../components/charts/BankrollChart.vue'
import StrategyPicker from '../components/StrategyPicker.vue'
import { EMPTY, odds, percent, shortDate, signedPercent, toneFor, units } from '../lib/format'

const { strategyBets, strategy } = useDataset()

/** Running total of the selected strategy at flat one-unit stakes. */
const series = computed(() => bankrollSeries(strategyBets.value))
const risk = computed(() => drawdown(series.value))

const total = computed(() => series.value.at(-1)?.cumulative ?? 0)
const settled = computed(() => series.value.length)
const roi = computed(() => (settled.value === 0 ? null : total.value / settled.value))

/** When a strategy mixes bet types, what each type added. */
const byMarket = computed(() => splitBy(strategyBets.value, (item) => item.market))

function toneClass(value: number | null): string {
  const tone = toneFor(value)
  return tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-critical' : 'text-ink'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <StrategyPicker />

    <section class="stat-grid" data-cols="5">
      <StatTile label="Units staked" :value="String(settled)" support="One unit per settled bet" />
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
        :confidence="confidenceFor(settled)"
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
      :note="`${strategy.label} at one unit a bet, in the order they settled. Break-even is the zero line.`"
    >
      <BankrollChart :points="series" />
    </SectionCard>

    <SectionCard title="Every settled bet">
      <div class="scroll-x">
        <table class="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-rule-strong text-left">
              <th class="px-4 py-2 font-medium text-ink-2">#</th>
              <th class="px-3 py-2 font-medium text-ink-2">Date</th>
              <th class="px-3 py-2 font-medium text-ink-2">Bet</th>
              <th class="px-3 py-2 font-medium text-ink-2">Type</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Price</th>
              <th class="px-3 py-2 font-medium text-ink-2">Result</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Units</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Running</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in series" :key="point.bet.id" class="border-b border-rule last:border-b-0">
              <td class="tnum px-4 py-2 text-muted">{{ point.index }}</td>
              <td class="tnum whitespace-nowrap px-3 py-2 text-ink-2">{{ shortDate(point.bet.date) }}</td>
              <td class="px-3 py-2 font-medium text-ink">
                {{ point.item.selection }}
                <span class="block text-[11.5px] font-normal text-muted">
                  {{ point.bet.selectedTeam }} v {{ point.bet.opponent }} · {{ point.bet.score }}
                </span>
              </td>
              <td class="px-3 py-2 text-ink-2">{{ point.item.market }}</td>
              <td class="tnum px-3 py-2 text-right">
                {{ odds(point.item.odds) }}
                <span v-if="point.item.estimated" class="ml-1 text-[10.5px] text-serious">estimated</span>
              </td>
              <td class="px-3 py-2"><ResultBadge :result="point.item.won ? 'W' : 'L'" compact /></td>
              <td class="tnum px-3 py-2 text-right" :class="point.profit > 0 ? 'text-good' : 'text-critical'">
                {{ units(point.profit) }}
              </td>
              <td class="tnum px-3 py-2 text-right font-semibold" :class="toneClass(point.cumulative)">
                {{ units(point.cumulative) }}
              </td>
            </tr>
            <tr v-if="series.length === 0">
              <td colspan="8" class="px-4 py-10 text-center text-muted">
                Nothing has settled for this strategy in this selection.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <SectionCard title="What the running total is made of">
      <div class="flex flex-col gap-3 px-4 py-4 text-[13px] leading-relaxed text-ink-2">
        <p class="max-w-[72ch]">
          {{ strategy.label }} is at
          <span class="tnum font-semibold" :class="toneClass(total)">
            {{ settled === 0 ? EMPTY : `${units(total)} units` }}
          </span>
          across {{ settled }} settled bet{{ settled === 1 ? '' : 's' }}, at one unit each.
        </p>
        <ul v-if="byMarket.length > 1" class="flex flex-col gap-1">
          <li v-for="part in byMarket" :key="part.label" class="tnum">
            <span class="font-medium text-ink">{{ part.label }}</span>:
            {{ part.stats.wins }}-{{ part.stats.losses }} ({{ percent(part.stats.hitRate) }} hit),
            <span :class="toneClass(part.stats.profit)">{{ units(part.stats.profit) }} units</span>
          </li>
        </ul>
        <p class="max-w-[72ch] text-muted">
          This is what flat staking every bet would have returned, not a record of an account.
          Staking varied in reality, so treat it as the method's result.
        </p>
      </div>
    </SectionCard>
  </div>
</template>
