<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDataset } from '../composables/useDataset'
import { GROUPS, applyStrategy, splitBy, strategyStats, type Strategy, type StrategyStats } from '../lib/strategies'
import SectionCard from '../components/ui/SectionCard.vue'
import StatTile from '../components/ui/StatTile.vue'
import ConfidenceMark from '../components/ui/ConfidenceMark.vue'
import { EMPTY, odds, percent, record, shortWeek, signedPercent, toneFor, units } from '../lib/format'

const { scoped, strategies, strategyId, strategy, strategyContext, strategyBets } = useDataset()

interface Row {
  strategy: Strategy
  stats: StrategyStats
}

const rows = computed<Row[]>(() =>
  strategies.value.map((s) => ({
    strategy: s,
    stats: strategyStats(applyStrategy(scoped.value, s.id, strategyContext.value)),
  })),
)

/** Grouped keeps like with like; "best first" ranks everything by ROI. */
const order = ref<'grouped' | 'roi'>('grouped')

type Line = { kind: 'heading'; label: string } | { kind: 'row'; row: Row }

const lines = computed<Line[]>(() => {
  if (order.value === 'roi') {
    return [...rows.value]
      .sort((a, b) => (b.stats.roi ?? -Infinity) - (a.stats.roi ?? -Infinity))
      .map((row) => ({ kind: 'row', row }))
  }
  return GROUPS.flatMap((group) => {
    const members = rows.value.filter((row) => row.strategy.group === group.id)
    if (members.length === 0) return []
    return [
      { kind: 'heading' as const, label: group.heading },
      ...members.map((row) => ({ kind: 'row' as const, row })),
    ]
  })
})

/** Most prices predicted means the ROI is a guess, not evidence. */
function mostlyPredicted(stats: StrategyStats): boolean {
  return stats.n > 0 && stats.estimated / stats.n > 0.5
}

const selected = computed(() => strategyStats(strategyBets.value))

/** One plain sentence on how far to trust the selected strategy's number. */
const verdict = computed(() => {
  const s = selected.value
  if (s.n === 0) return 'No finished match has a recorded price for this bet yet, so it cannot be tested.'
  if (mostlyPredicted(s)) {
    return `${s.estimated} of ${s.n} prices are predicted (~), not real prices. Treat this ROI as a guess until real prices are recorded.`
  }
  if (s.n < 25) return `Only ${s.n} bets. One or two results could flip this, so it is a lead, not a finding.`
  const steady = s.weekends > 0 && s.weekendsUp / s.weekends >= 0.6
  if ((s.roi ?? 0) > 0) {
    return steady
      ? `Profitable over ${s.n} bets and in ${s.weekendsUp} of ${s.weekends} weekends. The strongest kind of result this data can give.`
      : `Profitable over ${s.n} bets, but only in ${s.weekendsUp} of ${s.weekends} weekends: a few big weekends carry it.`
  }
  return `Losing over ${s.n} bets. It needs ${percent(s.breakEven, 0)} to break even and hits ${percent(s.hitRate, 0)}.`
})

const byLeague = computed(() =>
  splitBy(strategyBets.value, (item) => item.bet.league).sort((a, b) => b.stats.n - a.stats.n),
)
const byWeekend = computed(() => splitBy(strategyBets.value, (item) => item.bet.week).reverse())

function toneClass(value: number | null): string {
  const tone = toneFor(value)
  return tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-critical' : 'text-ink-2'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard
      title="Every strategy"
      note="Each rule run on every finished match that has its price. Click one to see it below and on every other page."
    >
      <template #actions>
        <label class="flex items-center gap-2 text-[12.5px] text-muted">
          Order
          <select
            v-model="order"
            class="min-h-10 rounded border border-rule bg-surface px-2 text-[14px] text-ink lg:min-h-0 lg:py-1 lg:text-[12.5px]"
          >
            <option value="grouped">Grouped</option>
            <option value="roi">Best ROI first</option>
          </select>
        </label>
      </template>

      <div class="scroll-x">
        <table class="w-full min-w-[760px] border-collapse whitespace-nowrap text-[13px]">
          <thead>
            <tr class="border-b border-rule-strong text-left">
              <th class="sticky left-0 z-10 bg-surface px-4 py-2 font-medium text-ink-2">Strategy</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Bets</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">ROI</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Units</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">W-L</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Hit</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2" title="Hit rate needed to break even">Needs</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Avg price</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2" title="Weekends in profit">Weekends up</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2" title="Prices that are predicted (~), not real">Predicted</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="line in lines" :key="line.kind === 'heading' ? `h-${line.label}` : line.row.strategy.id">
              <tr v-if="line.kind === 'heading'" class="border-b border-rule bg-sunken/60">
                <th colspan="10" scope="colgroup" class="sticky left-0 px-4 py-1.5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                  {{ line.label }}
                </th>
              </tr>
              <tr
                v-else
                class="cursor-pointer border-b border-rule last:border-b-0 hover:bg-sunken/50"
                :class="[
                  line.row.strategy.id === strategy.id ? 'bg-accent/10' : '',
                  line.row.stats.n === 0 ? 'opacity-45' : '',
                ]"
                @click="strategyId = line.row.strategy.id"
              >
                <th
                  scope="row"
                  class="sticky left-0 z-10 px-4 py-2 text-left font-medium"
                  :class="line.row.strategy.id === strategy.id ? 'bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))] text-accent' : 'bg-surface text-ink'"
                >
                  <button
                    type="button"
                    class="text-left"
                    :aria-pressed="line.row.strategy.id === strategy.id"
                    @click.stop="strategyId = line.row.strategy.id"
                  >
                    {{ line.row.strategy.label }}
                  </button>
                </th>
                <td class="tnum px-3 py-2 text-right">
                  <span class="inline-flex items-center gap-1.5">
                    {{ line.row.stats.n }}
                    <ConfidenceMark
                      v-if="line.row.stats.n > 0"
                      :confidence="line.row.stats.confidence"
                      :n="line.row.stats.n"
                    />
                  </span>
                </td>
                <td class="tnum px-3 py-2 text-right font-semibold" :class="toneClass(line.row.stats.roi)">
                  {{ signedPercent(line.row.stats.roi, 0) }}
                </td>
                <td class="tnum px-3 py-2 text-right" :class="toneClass(line.row.stats.profit)">
                  {{ line.row.stats.n === 0 ? EMPTY : units(line.row.stats.profit) }}
                </td>
                <td class="tnum px-3 py-2 text-right">
                  {{ line.row.stats.n === 0 ? EMPTY : record(line.row.stats.wins, line.row.stats.losses) }}
                </td>
                <td class="tnum px-3 py-2 text-right">{{ percent(line.row.stats.hitRate, 0) }}</td>
                <td class="tnum px-3 py-2 text-right text-muted">{{ percent(line.row.stats.breakEven, 0) }}</td>
                <td class="tnum px-3 py-2 text-right text-ink-2">{{ odds(line.row.stats.averageOdds) }}</td>
                <td class="tnum px-3 py-2 text-right text-ink-2">
                  {{ line.row.stats.weekends === 0 ? EMPTY : `${line.row.stats.weekendsUp} of ${line.row.stats.weekends}` }}
                </td>
                <td
                  class="tnum px-3 py-2 text-right"
                  :class="mostlyPredicted(line.row.stats) ? 'font-semibold text-serious' : 'text-muted'"
                >
                  {{ line.row.stats.n === 0 ? EMPTY : line.row.stats.estimated === 0 ? 'none' : `${line.row.stats.estimated} of ${line.row.stats.n}` }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="border-t border-rule px-4 py-2.5 text-[12px] leading-relaxed text-muted">
        "Needs" is the hit rate that breaks even at these prices. A row in orange under Predicted
        is mostly predicted prices, so its ROI is a guess. A +1.5 row stays empty until real +1.5
        prices are recorded: a missing price means the line was not offered, and it is never filled in.
      </p>
    </SectionCard>

    <section class="flex flex-col gap-4">
      <div class="rounded-md border border-rule bg-surface px-4 py-3">
        <p class="text-[12px] font-medium uppercase tracking-wide text-muted">Selected</p>
        <h2 class="mt-0.5 text-[20px] font-bold tracking-[-0.02em] text-ink">{{ strategy.label }}</h2>
        <p class="mt-1 text-[13px] text-ink-2">{{ strategy.describe }}</p>
        <p class="mt-2 max-w-[80ch] text-[13px] leading-relaxed text-ink">{{ verdict }}</p>
      </div>

      <div class="stat-grid" data-cols="5">
        <StatTile
          label="Bets"
          :value="String(selected.n)"
          :support="selected.n === 0 ? undefined : record(selected.wins, selected.losses)"
          :confidence="selected.n > 0 ? selected.confidence : undefined"
          :n="selected.n"
        />
        <StatTile
          label="Hit rate"
          :value="percent(selected.hitRate)"
          :support="selected.breakEven === null ? undefined : `Needs ${percent(selected.breakEven)}`"
        />
        <StatTile label="ROI" :value="signedPercent(selected.roi)" :tone="toneFor(selected.roi)" />
        <StatTile
          label="Units"
          :value="selected.n === 0 ? EMPTY : units(selected.profit)"
          :tone="toneFor(selected.profit)"
          :support="selected.averageOdds === null ? undefined : `Avg price ${odds(selected.averageOdds)}`"
        />
        <StatTile
          label="Weekends up"
          :value="selected.weekends === 0 ? EMPTY : `${selected.weekendsUp} of ${selected.weekends}`"
          support="Weekends in profit"
        />
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <SectionCard
          v-for="part in [
            { title: 'By league', dimension: 'League', rows: byLeague },
            { title: 'By weekend', dimension: 'Weekend', rows: byWeekend },
          ]"
          :key="part.title"
          :title="part.title"
        >
          <div class="scroll-x">
            <table class="w-full min-w-[460px] border-collapse whitespace-nowrap text-[13px]">
              <thead>
                <tr class="border-b border-rule-strong text-left">
                  <th class="px-4 py-2 font-medium text-ink-2">{{ part.dimension }}</th>
                  <th class="px-3 py-2 text-right font-medium text-ink-2">Bets</th>
                  <th class="px-3 py-2 text-right font-medium text-ink-2">W-L</th>
                  <th class="px-3 py-2 text-right font-medium text-ink-2">Hit</th>
                  <th class="px-3 py-2 text-right font-medium text-ink-2">Units</th>
                  <th class="px-3 py-2 text-right font-medium text-ink-2">ROI</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in part.rows" :key="row.label" class="border-b border-rule last:border-b-0">
                  <th scope="row" class="px-4 py-2 text-left font-medium text-ink">
                    {{ part.dimension === 'Weekend' ? shortWeek(row.label) : row.label }}
                  </th>
                  <td class="tnum px-3 py-2 text-right">
                    <span class="inline-flex items-center gap-1.5">
                      {{ row.stats.n }}
                      <ConfidenceMark :confidence="row.stats.confidence" :n="row.stats.n" />
                    </span>
                  </td>
                  <td class="tnum px-3 py-2 text-right">{{ record(row.stats.wins, row.stats.losses) }}</td>
                  <td class="tnum px-3 py-2 text-right">{{ percent(row.stats.hitRate, 0) }}</td>
                  <td class="tnum px-3 py-2 text-right" :class="toneClass(row.stats.profit)">{{ units(row.stats.profit) }}</td>
                  <td class="tnum px-3 py-2 text-right font-semibold" :class="toneClass(row.stats.roi)">
                    {{ signedPercent(row.stats.roi, 0) }}
                  </td>
                </tr>
                <tr v-if="part.rows.length === 0">
                  <td colspan="6" class="px-4 py-8 text-center text-muted">No settled bets for this strategy.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </section>
  </div>
</template>
