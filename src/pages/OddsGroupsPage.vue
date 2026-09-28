<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { segmentsByOddsGroup } from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import SegmentTable from '../components/SegmentTable.vue'
import OddsGroupChart from '../components/charts/OddsGroupChart.vue'
import { ODDS_GROUPS } from '../lib/types'
import { percent, signedPercent } from '../lib/format'

const { scoped } = useDataset()
const groups = computed(() => segmentsByOddsGroup(scoped.value))

/** Groups whose numbers are too thin to act on, named explicitly. */
const thin = computed(() =>
  groups.value.filter(
    (group) => group.strategy20.n > 0 && group.strategy20.confidence === 'low',
  ),
)

const best = computed(() => {
  const ranked = groups.value
    .filter((group) => group.strategy20.n >= 10 && group.strategy20.roi !== null)
    .sort((a, b) => (b.strategy20.roi ?? 0) - (a.strategy20.roi ?? 0))
  return ranked[0] ?? null
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard
      title="Odds groups"
      note="Groups are worked out from each pick's Match Winner price."
    >
      <div class="scroll-x border-b border-rule">
        <table class="w-full min-w-[420px] border-collapse text-[13px]">
          <tbody>
            <tr v-for="group in ODDS_GROUPS" :key="group.id" class="border-b border-rule last:border-b-0">
              <th scope="row" class="w-16 px-4 py-1.5 text-left font-medium text-ink">{{ group.id }}</th>
              <td class="tnum px-3 py-1.5 text-ink-2">
                {{ group.label.replace(`${group.id} `, '') }}
              </td>
              <td class="px-3 py-1.5 text-right text-muted">
                {{ groups.find((segment) => segment.key === group.id)?.bets.length ?? 0 }} picks
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <SegmentTable
        dimension="Group"
        :segments="groups"
        :columns="[
          'n',
          'winnerRecord',
          'winnerRoi',
          's20Record',
          's20Hit',
          'conditional',
          'conditionalBar',
          's20Roi',
          's20Profit',
        ]"
      />
    </SectionCard>

    <div class="grid gap-4 xl:grid-cols-2">
      <SectionCard
        title="Sweep rate given a correct pick"
        note="Bars only appear for groups with at least one correct winner pick."
      >
        <OddsGroupChart :segments="groups" measure="conditional" />
      </SectionCard>

      <SectionCard title="2-0 return by group" note="Flat stakes, break-even at the zero line.">
        <OddsGroupChart :segments="groups" measure="roi" />
      </SectionCard>
    </div>

    <SectionCard title="Reading this honestly">
      <div class="flex flex-col gap-3 px-4 py-4 text-[13px] leading-relaxed text-ink-2">
        <p v-if="best" class="max-w-[72ch]">
          On the current selection the strongest group with a usable sample is
          <span class="font-semibold text-ink">{{ best.label }}</span> at
          <span class="tnum font-semibold" :class="(best.strategy20.roi ?? 0) > 0 ? 'text-good' : 'text-critical'">
            {{ signedPercent(best.strategy20.roi) }}
          </span>
          across {{ best.strategy20.n }} settled 2-0 bets, sweeping
          {{ percent(best.conditional.rate) }} of the time when the winner pick was right.
        </p>
        <p v-else class="max-w-[72ch]">
          No group yet has ten or more settled 2-0 bets, so none of these returns should be
          treated as a finding.
        </p>

        <p v-if="thin.length > 0" class="max-w-[72ch]">
          <span class="text-critical">○</span>
          {{ thin.map((group) => group.label).join(', ') }}
          {{ thin.length === 1 ? 'has' : 'have' }} fewer than ten settled bets. A return that
          looks spectacular there is one or two results away from looking terrible, so it is
          not yet evidence of an edge.
        </p>

        <p class="max-w-[72ch] text-muted">
          The interval column shows where the true sweep rate plausibly sits. Where those bands
          overlap between two groups, the difference between them has not been demonstrated.
        </p>
      </div>
    </SectionCard>
  </div>
</template>
