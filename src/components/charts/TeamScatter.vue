<script setup lang="ts">
import { computed, ref } from 'vue'
import { defineChart, dot } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/charts/vue'
import type { ChartPoint } from '@tanstack/charts'
import type { TeamPoint } from '../../lib/stats'
import { assignColors } from '../../lib/palette'
import { useColorScheme } from '../../composables/useColorScheme'
import { odds, percent } from '../../lib/format'

const props = defineProps<{ points: readonly TeamPoint[] }>()

const { dark } = useColorScheme()

/**
 * Only teams with a resolved conditional rate can be placed on the y axis —
 * a team we never picked correctly has no "given we were right" value.
 */
const rows = computed<TeamPoint[]>(() =>
  props.points.filter((point) => point.conditionalSweepRate !== null),
)

/** Leagues are ordered by volume so the busiest keeps the first colour slot. */
const colors = computed(() => {
  const byVolume = new Map<string, number>()
  for (const row of rows.value) {
    byVolume.set(row.league, (byVolume.get(row.league) ?? 0) + row.picks)
  }
  const ordered = [...byVolume.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([league]) => league)
  return assignColors(ordered, dark.value)
})

/**
 * Explicit square-root radius scale: area, not radius, carries the pick count,
 * which is how a reader actually judges circle size. Radii are clamped to a
 * legible 5–20px so a one-pick team stays visible and hoverable.
 */
const R_MIN = 5
const R_MAX = 20
const radiusScale = computed(() => {
  const maxPicks = rows.value.reduce((max, row) => Math.max(max, row.picks), 1)
  const maxRoot = Math.sqrt(maxPicks)
  return (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return R_MIN
    return R_MIN + (Math.sqrt(value) / maxRoot) * (R_MAX - R_MIN)
  }
})

const chart = computed(() =>
  defineChart({
    marks: [
      dot(rows.value, {
        x: 'averageWinnerOdds',
        y: 'conditionalSweepRate',
        r: 'picks',
        rScale: radiusScale.value,
        color: 'league',
        fillOpacity: 0.72,
        // A surface-coloured ring keeps overlapping teams readable.
        stroke: dark.value ? '#1a1a19' : '#fcfcfb',
        strokeWidth: 2,
      }),
    ],
    scales: {
      x: {
        scale: scaleLinear,
        nice: true,
        axis: {
          label: 'Average Match Winner odds',
          ticks: { format: (value: number) => value.toFixed(2) },
        },
      },
      y: {
        scale: scaleLinear,
        axis: {
          label: 'P(2-0 | selected team wins)',
          ticks: { format: (value: number) => `${Math.round(value * 100)}%` },
        },
      },
    },
    // Teams that always sweep sit exactly on 1.0, so marks must be allowed to
    // paint past the plot edge instead of being sliced in half.
    clip: false,
    margin: { top: 18, right: 22, bottom: 46, left: 62 },
    color: { domain: colors.value.domain, range: colors.value.range },
    tooltip: {
      use: tooltip,
      // The original TeamPoint survives into the tooltip, so it can show the
      // fraction behind the rate rather than just the rate.
      format: (point: ChartPoint<TeamPoint>) => {
        const team = point.datum
        return [
          team.team,
          `${team.league} · ${team.picks} pick${team.picks === 1 ? '' : 's'}`,
          `Sweep when right: ${team.sweeps}/${team.correctWinnerPicks} (${percent(team.conditionalSweepRate)})`,
          `Avg winner odds: ${odds(team.averageWinnerOdds)}`,
        ].join('\n')
      },
    },
  }),
)

/** Typed focus callback — the row that came in is the row that comes back. */
const focused = ref<TeamPoint | null>(null)
function handleFocusChange(point: ChartPoint<TeamPoint> | null) {
  focused.value = point?.datum ?? null
}
</script>

<template>
  <div class="px-4 py-4">
    <div v-if="rows.length === 0" class="py-10 text-center text-[13px] text-muted">
      No team has a resolved sweep rate in this selection. Widen the week or mode filter.
    </div>

    <template v-else>
      <!-- Legend is always present for 2+ series; identity never rests on colour alone. -->
      <ul class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <li
          v-for="league in colors.domain"
          :key="league"
          class="flex items-center gap-1.5 text-[12px] text-ink-2"
        >
          <span
            class="h-2.5 w-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: colors.colorOf(league) }"
            aria-hidden="true"
          />
          {{ league }}
        </li>
      </ul>

      <!-- The plot has a minimum legible width; it scrolls rather than the page. -->
      <div class="scroll-x">
        <Chart
          :definition="chart"
          :height="360"
          :on-focus-change="handleFocusChange"
          aria-label="Average Match Winner odds against the probability of a 2-0 sweep given the selected team won, one circle per team, sized by number of picks and coloured by league."
          class="min-w-[460px]"
        />
      </div>

      <p class="mt-2 text-[12px] text-muted">
        Circle area is the number of picks. Hover or tab to a team for its record.
      </p>

      <!-- Focus readout: the exact-value equivalent of the hovered mark. -->
      <div
        class="mt-3 min-h-[2.5rem] rounded border border-rule bg-sunken px-3 py-2 text-[12.5px]"
        aria-live="polite"
      >
        <template v-if="focused">
          <span class="font-semibold text-ink">{{ focused.team }}</span>
          <span class="text-muted"> · {{ focused.league }}</span>
          <span class="tnum text-ink-2">
            — {{ focused.picks }} picks, swept
            {{ focused.sweeps }}/{{ focused.correctWinnerPicks }} when right
            ({{ percent(focused.conditionalSweepRate) }}), avg odds
            {{ odds(focused.averageWinnerOdds) }}
          </span>
        </template>
        <span v-else class="text-muted">Hover a circle to inspect a team.</span>
      </div>
    </template>
  </div>
</template>
