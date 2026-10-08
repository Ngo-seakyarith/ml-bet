<script setup lang="ts">
import { computed } from 'vue'
import { barY, defineChart, ruleY } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/vue'
import type { ChartPoint } from '@tanstack/charts'
import type { Segment } from '../../lib/stats'
import { useColorScheme } from '../../composables/useColorScheme'
import { percent, signedPercent } from '../../lib/format'

const props = defineProps<{
  segments: readonly Segment[]
  /** Which measure the bars carry. */
  measure: 'conditional' | 'roi'
}>()

const { dark } = useColorScheme()

interface GroupBar {
  group: string
  value: number
  n: number
  detail: string
}

const rows = computed<GroupBar[]>(() =>
  props.segments
    .map((segment) => {
      if (props.measure === 'conditional') {
        return {
          group: segment.key,
          value: segment.conditional.rate ?? 0,
          n: segment.conditional.correctWinnerPicks,
          detail: `${segment.conditional.sweeps}/${segment.conditional.correctWinnerPicks} swept`,
        }
      }
      return {
        group: segment.key,
        value: segment.strategy.roi ?? 0,
        n: segment.strategy.n,
        detail: `${segment.strategy.wins}-${segment.strategy.losses} from ${segment.strategy.n} bets`,
      }
    })
    .filter((row) => row.n > 0),
)

/**
 * One measure, one colour — this is a magnitude comparison across ordered
 * groups, not five competing identities, so a categorical ramp would be noise.
 * ROI can go negative, so it gets a zero rule to read against.
 */
const barColor = computed(() => (dark.value ? '#3987e5' : '#2a78d6'))

const chart = computed(() =>
  defineChart({
    marks: [
      barY(rows.value, {
        x: 'group',
        y: 'value',
        fill: barColor.value,
        fillOpacity: 0.85,
        // Rounded data-end only, so the baseline stays a hard edge.
        radius: { end: 4 },
        maxThickness: 56,
      }),
      ...(props.measure === 'roi' ? [ruleY([0])] : []),
    ],
    scales: {
      x: { scale: scaleBand },
      y: {
        scale: scaleLinear,
        nice: true,
        axis: {
          label: props.measure === 'conditional' ? 'P(2-0 | winner correct)' : '2-0 ROI',
          ticks: {
            format: (value: number) =>
              props.measure === 'roi' && value > 0
                ? `+${Math.round(value * 100)}%`
                : `${Math.round(value * 100)}%`,
          },
        },
      },
    },
    tooltip: {
      use: tooltip,
      format: (point: ChartPoint<GroupBar>) => {
        const row = point.datum
        const headline =
          props.measure === 'conditional' ? percent(row.value) : signedPercent(row.value)
        return `${row.group}\n${headline}\n${row.detail}`
      },
    },
  }),
)

const ariaLabel = computed(() =>
  props.measure === 'conditional'
    ? 'Probability of a 2-0 sweep given the winner pick was correct, by Match Winner odds group G1 to G5.'
    : 'Return on investment of the 2-0 strategy by Match Winner odds group G1 to G5.',
)
</script>

<template>
  <div class="px-4 py-4">
    <div v-if="rows.length === 0" class="py-8 text-center text-[13px] text-muted">
      No resolved bets in this selection.
    </div>
    <!-- The plot has a minimum legible width; it scrolls rather than the page. -->
    <div v-else class="scroll-x">
      <Chart :definition="chart" :height="240" :aria-label="ariaLabel" class="min-w-[400px]" />
    </div>
  </div>
</template>
