<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { segmentsByOddsGroup, summarize, teamPoints } from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import StatTile from '../components/ui/StatTile.vue'
import ConfidenceMark from '../components/ui/ConfidenceMark.vue'
import IntervalBar from '../components/ui/IntervalBar.vue'
import SegmentTable from '../components/SegmentTable.vue'
import OddsGroupChart from '../components/charts/OddsGroupChart.vue'
import TeamScatter from '../components/charts/TeamScatter.vue'
import { EMPTY, percent, record, signedPercent, units } from '../lib/format'
import { toneFor } from '../lib/format'

const { scoped } = useDataset()

const summary = computed(() => summarize(scoped.value))
const groups = computed(() => segmentsByOddsGroup(scoped.value))
const points = computed(() => teamPoints(scoped.value))

/** The three strategies stay on separate rows — pooling them would be a lie. */
const strategies = computed(() => [
  {
    name: 'Match Winner',
    performance: summary.value.winner,
    note: 'Every tracked match, regardless of which market was played.',
  },
  {
    name: 'Correct Score 2-0',
    performance: summary.value.strategy20,
    note: 'Selected team to sweep. The strategy under test.',
  },
  {
    name: 'Over 2.5 maps',
    performance: summary.value.over25,
    note: 'Tracked separately — a different bet with a different distribution.',
  },
])
</script>

<template>
  <div class="flex flex-col gap-4">
    <!--
      The hero is the conditional rate rather than the raw hit rate, because it
      is the only one that isolates what the 2-0 market actually prices.
    -->
    <section class="rounded-md border border-rule bg-surface">
      <div class="grid gap-6 px-5 py-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-center">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-[13px] font-medium text-ink-2">
              Sweep rate when the pick is right
            </h2>
            <ConfidenceMark
              :confidence="summary.conditional.confidence"
              :n="summary.conditional.correctWinnerPicks"
              unit="correct winner picks"
            />
          </div>

          <p class="tnum mt-2 text-[62px] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
            {{ percent(summary.conditional.rate) }}
          </p>

          <p class="tnum mt-2 text-[13px] text-ink-2">
            {{ summary.conditional.sweeps }} of
            {{ summary.conditional.correctWinnerPicks }} correct winner picks ended 2-0
          </p>

          <div class="mt-3 max-w-[18rem]">
            <IntervalBar
              :value="summary.conditional.rate"
              :interval="summary.conditional.ci"
              size="lg"
            />
          </div>
        </div>

        <div class="border-t border-rule pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <p class="max-w-[54ch] text-[13.5px] leading-relaxed text-ink-2">
            This is
            <span class="font-semibold text-ink">P(2-0 | selected team wins)</span>, not the raw
            2-0 hit rate. It answers the question the 2-0 market actually asks: once we have
            picked the right team, how often do they close it out in two maps?
          </p>
          <p class="mt-3 max-w-[54ch] text-[13px] leading-relaxed text-muted">
            Raw 2-0 hit rate is {{ percent(summary.strategy20.hitRate) }} because it is also
            paying for every match where the winner pick was simply wrong. Separating the two
            tells you which half of the bet is failing.
          </p>
        </div>
      </div>
    </section>

    <!-- Headline counters -->
    <section class="stat-grid" data-cols="6">
      <StatTile
        label="Matches"
        :value="String(summary.totalMatches)"
        :support="`${summary.weeks} week${summary.weeks === 1 ? '' : 's'} · ${summary.leagues} leagues`"
      />
      <StatTile
        label="Winner accuracy"
        :value="percent(summary.winner.hitRate)"
        :support="record(summary.winner.wins, summary.winner.losses)"
        :confidence="summary.winner.confidence"
        :n="summary.winner.n"
      />
      <StatTile
        label="Pure 2-0 hit rate"
        :value="percent(summary.strategy20.hitRate)"
        :support="record(summary.strategy20.wins, summary.strategy20.losses)"
        :confidence="summary.strategy20.confidence"
        :n="summary.strategy20.n"
      />
      <StatTile
        label="Winner ROI"
        :value="signedPercent(summary.winner.roi)"
        :support="`${units(summary.winner.profit)} units`"
        :tone="toneFor(summary.winner.roi)"
      />
      <StatTile
        label="2-0 ROI"
        :value="signedPercent(summary.strategy20.roi)"
        :support="`${units(summary.strategy20.profit)} units`"
        :tone="toneFor(summary.strategy20.roi)"
      />
      <StatTile
        label="Favourite upsets"
        :value="percent(summary.upsets.rate)"
        :support="`${summary.upsets.favouriteLosses} of ${summary.upsets.favouriteSelections} favourites lost`"
      />
    </section>

    <SectionCard
      title="Strategy comparison"
      note="Over 2.5 is never pooled with 2-0. Flat one-unit stakes throughout."
    >
      <div class="scroll-x">
        <table class="w-full min-w-[620px] border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-rule-strong text-left">
              <th class="px-4 py-2 font-medium text-ink-2">Strategy</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Settled</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">W-L</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Hit rate</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Units</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">ROI</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="strategy in strategies"
              :key="strategy.name"
              class="border-b border-rule last:border-b-0"
              :class="strategy.performance.n === 0 ? 'opacity-45' : ''"
            >
              <th scope="row" class="px-4 py-2.5 text-left font-medium text-ink">
                {{ strategy.name }}
                <span class="block text-[11.5px] font-normal text-muted">{{ strategy.note }}</span>
              </th>
              <td class="tnum px-3 py-2.5 text-right">
                <span class="inline-flex items-center gap-1.5">
                  {{ strategy.performance.n }}
                  <ConfidenceMark
                    v-if="strategy.performance.n > 0"
                    :confidence="strategy.performance.confidence"
                    :n="strategy.performance.n"
                  />
                </span>
              </td>
              <td class="tnum px-3 py-2.5 text-right">
                {{ record(strategy.performance.wins, strategy.performance.losses) }}
              </td>
              <td class="tnum px-3 py-2.5 text-right">
                {{ percent(strategy.performance.hitRate) }}
              </td>
              <td
                class="tnum px-3 py-2.5 text-right"
                :class="toneFor(strategy.performance.profit) === 'good' ? 'text-good' : toneFor(strategy.performance.profit) === 'bad' ? 'text-critical' : ''"
              >
                {{ strategy.performance.n === 0 ? EMPTY : units(strategy.performance.profit) }}
              </td>
              <td
                class="tnum px-3 py-2.5 text-right font-semibold"
                :class="toneFor(strategy.performance.roi) === 'good' ? 'text-good' : toneFor(strategy.performance.roi) === 'bad' ? 'text-critical' : ''"
              >
                {{ signedPercent(strategy.performance.roi) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <div class="grid gap-4 xl:grid-cols-2">
      <SectionCard
        title="Sweep rate by odds group"
        note="Only matches where the winner pick was already correct."
      >
        <OddsGroupChart :segments="groups" measure="conditional" />
      </SectionCard>

      <SectionCard title="2-0 return by odds group" note="Flat stakes. Zero line is break-even.">
        <OddsGroupChart :segments="groups" measure="roi" />
      </SectionCard>
    </div>

    <SectionCard
      title="Odds group detail"
      note="A hollow or half marker means the sample is too small to lean on."
    >
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
          's20Roi',
        ]"
      />
    </SectionCard>

    <SectionCard
      title="Teams: how they are priced against how they close"
      note="Circle area is the number of picks. Every tracked pick is in view."
    >
      <TeamScatter :points="points" />
    </SectionCard>
  </div>
</template>
