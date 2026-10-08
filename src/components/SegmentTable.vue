<script setup lang="ts">
import ConfidenceMark from './ui/ConfidenceMark.vue'
import IntervalBar from './ui/IntervalBar.vue'
import type { Segment } from '../lib/stats'
import { EMPTY, percent, record, signedPercent, units } from '../lib/format'

export type SegmentColumn =
  | 'n'
  | 'winnerRecord'
  | 'winnerHit'
  | 'winnerRoi'
  | 'sweepRate'
  | 'strategyRecord'
  | 'strategyHit'
  | 'strategyRoi'
  | 'strategyProfit'
  | 'conditional'
  | 'conditionalBar'
  | 'upset'

const props = defineProps<{
  segments: readonly Segment[]
  columns: readonly SegmentColumn[]
  /** Heading for the first column, e.g. "Group" or "League". */
  dimension: string
  /** Rows with no resolved bets are dimmed rather than hidden. */
  emptyMessage?: string
}>()

const HEADINGS: Record<SegmentColumn, string> = {
  n: 'Matches',
  winnerRecord: 'Winner W-L',
  winnerHit: 'Winner accuracy',
  winnerRoi: 'Winner ROI',
  sweepRate: 'Sweep rate',
  strategyRecord: 'Strategy W-L',
  strategyHit: 'Strategy hit',
  strategyRoi: 'Strategy ROI',
  strategyProfit: 'Strategy units',
  conditional: '2-0 given winner',
  conditionalBar: '95% interval',
  upset: 'Favourite upsets',
}

const NUMERIC: ReadonlySet<SegmentColumn> = new Set<SegmentColumn>([
  'n',
  'winnerHit',
  'winnerRoi',
  'sweepRate',
  'strategyHit',
  'strategyRoi',
  'strategyProfit',
  'conditional',
  'upset',
])

function roiTone(value: number | null): string {
  if (value === null) return 'text-ink-2'
  if (value > 0) return 'text-good'
  if (value < 0) return 'text-critical'
  return 'text-ink-2'
}

function isEmpty(segment: Segment): boolean {
  return segment.bets.length === 0
}

defineExpose({ columns: props.columns })
</script>

<template>
  <div class="scroll-x">
    <table class="w-full min-w-[640px] border-collapse text-[13px]">
      <thead>
        <tr class="border-b border-rule-strong text-left">
          <th class="px-4 py-2 font-medium text-ink-2">{{ dimension }}</th>
          <th
            v-for="column in columns"
            :key="column"
            class="px-3 py-2 font-medium text-ink-2"
            :class="NUMERIC.has(column) ? 'text-right' : 'text-left'"
          >
            {{ HEADINGS[column] }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="segment in segments"
          :key="segment.key"
          class="border-b border-rule last:border-b-0"
          :class="isEmpty(segment) ? 'opacity-45' : ''"
        >
          <th scope="row" class="px-4 py-2 text-left font-medium text-ink">
            {{ segment.label }}
          </th>

          <td
            v-for="column in columns"
            :key="column"
            class="tnum px-3 py-2"
            :class="NUMERIC.has(column) ? 'text-right' : 'text-left'"
          >
            <template v-if="column === 'n'">{{ segment.bets.length }}</template>

            <template v-else-if="column === 'winnerRecord'">
              {{ record(segment.winner.wins, segment.winner.losses) }}
            </template>

            <template v-else-if="column === 'winnerHit'">
              <span class="inline-flex items-center justify-end gap-1.5">
                {{ percent(segment.winner.hitRate) }}
                <ConfidenceMark
                  v-if="segment.winner.n > 0"
                  :confidence="segment.winner.confidence"
                  :n="segment.winner.n"
                />
              </span>
            </template>

            <template v-else-if="column === 'winnerRoi'">
              <span :class="roiTone(segment.winner.roi)">
                {{ signedPercent(segment.winner.roi) }}
              </span>
            </template>

            <template v-else-if="column === 'sweepRate'">
              {{ percent(segment.sweepRate) }}
            </template>

            <template v-else-if="column === 'strategyRecord'">
              {{ record(segment.strategy.wins, segment.strategy.losses) }}
            </template>

            <template v-else-if="column === 'strategyHit'">
              <span class="inline-flex items-center justify-end gap-1.5">
                {{ percent(segment.strategy.hitRate) }}
                <ConfidenceMark
                  v-if="segment.strategy.n > 0"
                  :confidence="segment.strategy.confidence"
                  :n="segment.strategy.n"
                />
              </span>
            </template>

            <template v-else-if="column === 'strategyRoi'">
              <span :class="roiTone(segment.strategy.roi)">
                {{ signedPercent(segment.strategy.roi) }}
              </span>
            </template>

            <template v-else-if="column === 'strategyProfit'">
              <span :class="roiTone(segment.strategy.profit)">
                {{ segment.strategy.n === 0 ? EMPTY : units(segment.strategy.profit) }}
              </span>
            </template>

            <template v-else-if="column === 'conditional'">
              <span class="inline-flex items-center justify-end gap-1.5">
                <span class="font-semibold">{{ percent(segment.conditional.rate) }}</span>
                <span class="text-[11.5px] text-muted">
                  {{ segment.conditional.sweeps }}/{{ segment.conditional.correctWinnerPicks }}
                </span>
                <ConfidenceMark
                  v-if="segment.conditional.correctWinnerPicks > 0"
                  :confidence="segment.conditional.confidence"
                  :n="segment.conditional.correctWinnerPicks"
                  unit="correct winner picks"
                />
              </span>
            </template>

            <template v-else-if="column === 'conditionalBar'">
              <div class="min-w-[92px]">
                <IntervalBar :value="segment.conditional.rate" :interval="segment.conditional.ci" />
              </div>
            </template>

            <template v-else-if="column === 'upset'">
              <span class="inline-flex items-center justify-end gap-1.5">
                {{ percent(segment.upsets.rate) }}
                <span class="text-[11.5px] text-muted">
                  {{ segment.upsets.favouriteLosses }}/{{ segment.upsets.favouriteSelections }}
                </span>
              </span>
            </template>
          </td>
        </tr>

        <tr v-if="segments.length === 0">
          <td :colspan="columns.length + 1" class="px-4 py-8 text-center text-muted">
            {{ emptyMessage ?? 'Nothing in this selection.' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
