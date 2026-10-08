<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { segmentsByWeek } from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import SegmentTable from '../components/SegmentTable.vue'
import StrategyPicker from '../components/StrategyPicker.vue'
import { percent } from '../lib/format'

const { scoped, measure } = useDataset()
const weeks = computed(() => segmentsByWeek(scoped.value, measure.value))

/** The spread in favourite-upset rate is what makes a good week look like skill. */
const upsetSpread = computed(() => {
  const rates = weeks.value
    .filter((week) => week.upsets.favouriteSelections > 0 && week.upsets.rate !== null)
    .map((week) => ({ label: week.label, rate: week.upsets.rate as number }))
  if (rates.length < 2) return null
  const sorted = [...rates].sort((a, b) => a.rate - b.rate)
  return { calmest: sorted[0]!, roughest: sorted[sorted.length - 1]! }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <StrategyPicker />

    <SectionCard
      title="Week by week"
      note="Each weekend on its own. The global week filter above narrows every other page; this one always shows them side by side."
    >
      <SegmentTable
        dimension="Weekend"
        :segments="weeks"
        :columns="[
          'n',
          'strategyRecord',
          'strategyRoi',
          'strategyProfit',
          'winnerHit',
          'winnerRoi',
          'conditional',
          'upset',
        ]"
        empty-message="No weeks in this selection."
      />
    </SectionCard>

    <SectionCard title="Favourite upsets" note="How often the favourite we backed lost outright.">
      <div class="flex flex-col gap-3 px-4 py-4 text-[13px] leading-relaxed text-ink-2">
        <p v-if="upsetSpread" class="max-w-[72ch]">
          Favourites failed
          <span class="tnum font-semibold text-ink">{{ percent(upsetSpread.roughest.rate) }}</span>
          of the time in {{ upsetSpread.roughest.label }} against
          <span class="tnum font-semibold text-ink">{{ percent(upsetSpread.calmest.rate) }}</span>
          in {{ upsetSpread.calmest.label }}. A strategy built on favourites will look like a
          different strategy in those two weekends without anything about it having changed.
        </p>
        <p v-else class="max-w-[72ch]">
          Only one weekend has resolved favourite picks so far, so there is nothing to compare
          yet. This section becomes useful from the second weekend onward.
        </p>

        <ul class="mt-1 flex flex-col gap-2">
          <li
            v-for="week in weeks"
            :key="week.key"
            class="flex flex-wrap items-center gap-3 border-b border-rule pb-2 last:border-b-0"
          >
            <span class="w-40 shrink-0 font-medium text-ink">{{ week.label }}</span>
            <div class="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-sunken">
              <div
                class="h-full rounded-full bg-serious"
                :style="{ width: `${(week.upsets.rate ?? 0) * 100}%` }"
              />
            </div>
            <span class="tnum w-32 shrink-0 text-right text-ink-2">
              {{ percent(week.upsets.rate) }}
              <span class="text-muted">
                ({{ week.upsets.favouriteLosses }}/{{ week.upsets.favouriteSelections }})
              </span>
            </span>
          </li>
        </ul>
      </div>
    </SectionCard>
  </div>
</template>
