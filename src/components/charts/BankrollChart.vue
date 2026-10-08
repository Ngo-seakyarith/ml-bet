<script setup lang="ts">
import { computed } from 'vue'
import { defineChart, lineY, ruleY } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/vue'
import type { ChartPoint } from '@tanstack/charts'
import type { BankrollPoint } from '../../lib/stats'
import { useColorScheme } from '../../composables/useColorScheme'
import { odds, shortDate, units } from '../../lib/format'

const props = defineProps<{ points: readonly BankrollPoint[] }>()

const { dark } = useColorScheme()

/** Bet number, not date — settled bets are the unit of account here. */
const rows = computed(() => props.points.slice())

const lineColor = computed(() => (dark.value ? '#3987e5' : '#2a78d6'))

const chart = computed(() =>
  defineChart({
    marks: [
      // Break-even is the only line that matters for a bankroll.
      ruleY([0]),
      lineY(rows.value, {
        x: 'index',
        y: 'cumulative',
        stroke: lineColor.value,
        strokeWidth: 2,
        points: true,
      }),
    ],
    scales: {
      x: {
        scale: scaleLinear,
        axis: {
          label: 'Settled bet',
          // Bet numbers are whole; fractional ticks would be meaningless.
          ticks: { format: (value: number) => (Number.isInteger(value) ? String(value) : '') },
        },
      },
      y: {
        scale: scaleLinear,
        nice: true,
        axis: {
          label: 'Cumulative units',
          ticks: { format: (value: number) => (value > 0 ? `+${value}` : String(value)) },
        },
      },
    },
    focus: 'nearest-x',
    tooltip: {
      use: tooltip,
      format: (point: ChartPoint<BankrollPoint>) => {
        const row = point.datum
        return [
          `Bet ${row.index} · ${shortDate(row.bet.date)}`,
          row.item.selection,
          `@${odds(row.item.odds)} ${row.item.won ? 'W' : 'L'} ${units(row.profit)}`,
          `Running total ${units(row.cumulative)} units`,
        ].join('\n')
      },
    },
  }),
)
</script>

<template>
  <div class="px-4 py-4">
    <div v-if="rows.length === 0" class="py-8 text-center text-[13px] text-muted">
      No settled bets yet. Mark a row as <code class="text-ink-2">placed</code> in the CSV to start
      tracking a bankroll.
    </div>
    <!-- The plot has a minimum legible width; it scrolls rather than the page. -->
    <div v-else class="scroll-x">
      <Chart
        :definition="chart"
        :height="260"
        aria-label="Cumulative profit in units across settled bets, in the order they were placed."
        class="min-w-[400px]"
      />
    </div>
  </div>
</template>
