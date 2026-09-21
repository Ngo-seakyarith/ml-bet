<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { segmentsByLeague, teamPoints } from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import SegmentTable from '../components/SegmentTable.vue'
import TeamScatter from '../components/charts/TeamScatter.vue'
import { percent } from '../lib/format'

const { scoped } = useDataset()
const leagues = computed(() => segmentsByLeague(scoped.value))
const points = computed(() => teamPoints(scoped.value))

/** Leagues with enough matches to be worth comparing at all. */
const comparable = computed(() =>
  leagues.value.filter((league) => league.conditional.correctWinnerPicks >= 5),
)

const sweepSpread = computed(() => {
  if (comparable.value.length < 2) return null
  const sorted = [...comparable.value].sort(
    (a, b) => (a.conditional.rate ?? 0) - (b.conditional.rate ?? 0),
  )
  return { lowest: sorted[0]!, highest: sorted[sorted.length - 1]! }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard
      title="Leagues"
      note="Sweep rate is how often a match ended 2-0 either way; the conditional column is how often our pick swept."
    >
      <SegmentTable
        dimension="League"
        :segments="leagues"
        :columns="[
          'n',
          'winnerHit',
          'sweepRate',
          'conditional',
          'conditionalBar',
          's20Hit',
          's20Roi',
          's20Profit',
        ]"
        empty-message="No leagues in this selection."
      />
    </SectionCard>

    <SectionCard title="Is one league sweepier than another?">
      <div class="px-4 py-4 text-[13px] leading-relaxed text-ink-2">
        <p v-if="sweepSpread" class="max-w-[72ch]">
          Among leagues with at least five correct winner picks,
          <span class="font-semibold text-ink">{{ sweepSpread.highest.label }}</span> sweeps
          <span class="tnum font-semibold text-ink">{{ percent(sweepSpread.highest.conditional.rate) }}</span>
          of the time against
          <span class="tnum font-semibold text-ink">{{ percent(sweepSpread.lowest.conditional.rate) }}</span>
          for <span class="font-semibold text-ink">{{ sweepSpread.lowest.label }}</span>. Check
          whether their intervals overlap in the table above before treating that gap as real —
          at these sample sizes they usually do.
        </p>
        <p v-else class="max-w-[72ch]">
          No two leagues yet have five or more correct winner picks each, so there is nothing to
          compare. League differences need roughly a season of rows before they mean anything.
        </p>
      </div>
    </SectionCard>

    <SectionCard
      title="Teams by league"
      note="Circle area is pick count. Teams near the top are the ones that close out matches."
    >
      <TeamScatter :points="points" />
    </SectionCard>
  </div>
</template>
