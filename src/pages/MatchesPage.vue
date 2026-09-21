<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/vue-table'
import { ALL, useDataset } from '../composables/useDataset'
import SectionCard from '../components/ui/SectionCard.vue'
import ResultBadge from '../components/ui/ResultBadge.vue'
import { EMPTY, odds, shortDate, units } from '../lib/format'
import { ODDS_GROUPS, type Bet } from '../lib/types'

const { filtered, filters, leagues, teams, activeFilterCount, resetFilters } = useDataset()

/* Sorting is the only table feature this view needs. */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
})

/**
 * Columns drive sorting and header labels. Cells are rendered by the template
 * below from `row.original`, because these are badges and toned figures rather
 * than plain text.
 */
const helper = createColumnHelper<typeof features, Bet>()
const columns = helper.columns([
  helper.accessor('date', { header: 'Date', sortFn: 'alphanumeric' }),
  helper.accessor('league', { header: 'League', sortFn: 'alphanumeric' }),
  helper.accessor('selectedTeam', { header: 'Selected', sortFn: 'alphanumeric' }),
  helper.accessor('opponent', { header: 'Opponent', sortFn: 'alphanumeric' }),
  helper.accessor('winnerOdds', { header: 'Win odds', sortFn: 'basic' }),
  helper.accessor('effectiveOdds', { header: 'Strategy odds', sortFn: 'basic' }),
  helper.accessor('score', { header: 'Score', sortFn: 'alphanumeric' }),
  helper.accessor('winnerResult', { header: 'Winner', sortFn: 'alphanumeric' }),
  helper.accessor('strategyResult', { header: 'Strategy', sortFn: 'alphanumeric' }),
  helper.accessor('strategyProfit', { header: 'Units', sortFn: 'basic' }),
])

const RIGHT_ALIGNED = new Set(['winnerOdds', 'effectiveOdds', 'strategyProfit'])

const table = useTable({ features, columns, data: filtered })

/** Row expansion is local UI state, so it lives here rather than in the table. */
const expanded = ref<Set<number>>(new Set())
function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

const rows = computed(() => table.getRowModel().rows)

const QUALITY_LABEL: Record<string, string> = {
  actual: 'Actual',
  snapshot: 'Snapshot',
  estimated: 'Estimated',
  none: 'None',
}

/** Estimated prices are flagged so a backtest ROI is never mistaken for real. */
function qualityClass(quality: string): string {
  return quality === 'estimated' ? 'text-serious' : 'text-muted'
}

function profitClass(bet: Bet): string {
  if (bet.strategyProfit === null) return 'text-muted'
  return bet.strategyProfit > 0 ? 'text-good' : 'text-critical'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard
      title="Matches"
      note="Every row in the CSV. Click a match to see its notes, price history and source."
    >
      <template #actions>
        <button
          v-if="activeFilterCount > 0"
          type="button"
          class="rounded border border-rule px-2 py-1 text-[12px] text-ink-2 hover:bg-sunken"
          @click="resetFilters"
        >
          Clear {{ activeFilterCount }} filter{{ activeFilterCount === 1 ? '' : 's' }}
        </button>
      </template>

      <!-- Filters sit in one row above the table. -->
      <div class="flex flex-wrap items-end gap-2 border-b border-rule px-4 py-3">
        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">Search</span>
          <input
            v-model="filters.search"
            type="search"
            placeholder="Team, league or note"
            class="w-48 rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink placeholder:text-muted"
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">League</span>
          <select v-model="filters.league" class="rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink">
            <option :value="ALL">All</option>
            <option v-for="league in leagues" :key="league" :value="league">{{ league }}</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">Odds group</span>
          <select v-model="filters.oddsGroup" class="rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink">
            <option :value="ALL">All</option>
            <option v-for="group in ODDS_GROUPS" :key="group.id" :value="group.id">
              {{ group.label }}
            </option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">Market</span>
          <select v-model="filters.market" class="rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink">
            <option :value="ALL">All</option>
            <option value="2-0">2-0</option>
            <option value="Over 2.5">Over 2.5</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">Winner</span>
          <select v-model="filters.winnerResult" class="rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink">
            <option :value="ALL">All</option>
            <option value="W">Won</option>
            <option value="L">Lost</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">Strategy</span>
          <select v-model="filters.strategyResult" class="rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink">
            <option :value="ALL">All</option>
            <option value="W">Won</option>
            <option value="L">Lost</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">Price</span>
          <select v-model="filters.oddsQuality" class="rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink">
            <option :value="ALL">All</option>
            <option value="actual">Actual</option>
            <option value="snapshot">Snapshot</option>
            <option value="estimated">Estimated</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">Map score</span>
          <select v-model="filters.sweep" class="rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink">
            <option :value="ALL">All</option>
            <option value="sweep">2-0 sweeps</option>
            <option value="decider">Went to game 3</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-[11.5px] text-muted">Team</span>
          <select v-model="filters.team" class="rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink">
            <option :value="ALL">All</option>
            <option v-for="team in teams" :key="team" :value="team">{{ team }}</option>
          </select>
        </label>
      </div>

      <div class="scroll-x">
        <table class="w-full min-w-[980px] border-collapse text-[13px]">
          <thead>
            <tr
              v-for="group in table.getHeaderGroups()"
              :key="group.id"
              class="border-b border-rule-strong text-left"
            >
              <th class="w-8 px-2 py-2" />
              <th
                v-for="header in group.headers"
                :key="header.id"
                class="px-3 py-2 font-medium text-ink-2"
                :class="RIGHT_ALIGNED.has(header.column.id) ? 'text-right' : 'text-left'"
                :aria-sort="
                  header.column.getIsSorted() === 'asc'
                    ? 'ascending'
                    : header.column.getIsSorted() === 'desc'
                      ? 'descending'
                      : 'none'
                "
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-ink"
                  @click="header.column.toggleSorting()"
                >
                  {{ header.column.columnDef.header }}
                  <span aria-hidden="true" class="text-[10px] text-muted">
                    {{
                      header.column.getIsSorted() === 'asc'
                        ? '▲'
                        : header.column.getIsSorted() === 'desc'
                          ? '▼'
                          : '↕'
                    }}
                  </span>
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            <template v-for="row in rows" :key="row.id">
              <tr
                class="cursor-pointer border-b border-rule hover:bg-sunken"
                @click="toggle(row.original.id)"
              >
                <td class="px-2 py-2 text-center text-[10px] text-muted">
                  <span aria-hidden="true">{{ expanded.has(row.original.id) ? '▾' : '▸' }}</span>
                </td>
                <td class="tnum whitespace-nowrap px-3 py-2 text-ink-2">
                  {{ shortDate(row.original.date) }}
                </td>
                <td class="whitespace-nowrap px-3 py-2 text-ink-2">{{ row.original.league }}</td>
                <td class="whitespace-nowrap px-3 py-2 font-medium text-ink">
                  {{ row.original.selectedTeam }}
                </td>
                <td class="whitespace-nowrap px-3 py-2 text-ink-2">{{ row.original.opponent }}</td>
                <td class="tnum px-3 py-2 text-right">{{ odds(row.original.winnerOdds) }}</td>
                <td class="tnum px-3 py-2 text-right">
                  {{ odds(row.original.effectiveOdds) }}
                  <span class="ml-1 text-[10.5px]" :class="qualityClass(row.original.oddsQuality)">
                    {{ QUALITY_LABEL[row.original.oddsQuality] }}
                  </span>
                </td>
                <td class="tnum px-3 py-2 text-ink-2">{{ row.original.score }}</td>
                <td class="px-3 py-2">
                  <ResultBadge :result="row.original.winnerResult" compact />
                </td>
                <td class="px-3 py-2">
                  <ResultBadge :result="row.original.strategyResult" compact />
                  <span class="ml-1.5 text-[11px] text-muted">{{ row.original.market }}</span>
                </td>
                <td class="tnum px-3 py-2 text-right" :class="profitClass(row.original)">
                  {{ row.original.strategyProfit === null ? EMPTY : units(row.original.strategyProfit) }}
                </td>
              </tr>

              <tr v-if="expanded.has(row.original.id)" class="border-b border-rule bg-sunken">
                <td :colspan="columns.length + 1" class="px-4 py-3">
                  <dl class="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt class="text-[11.5px] text-muted">Pick</dt>
                      <dd class="text-[13px] text-ink">{{ row.original.selection }}</dd>
                    </div>
                    <div>
                      <dt class="text-[11.5px] text-muted">Prices seen</dt>
                      <dd class="tnum text-[13px] text-ink">
                        <span v-if="row.original.oddsSnapshot !== null">
                          Snapshot {{ odds(row.original.oddsSnapshot) }}
                        </span>
                        <span v-if="row.original.oddsActual !== null">
                          <span v-if="row.original.oddsSnapshot !== null" class="text-muted"> → </span>
                          Actual {{ odds(row.original.oddsActual) }}
                        </span>
                        <span v-if="row.original.oddsEstimated !== null" class="text-serious">
                          Estimated {{ odds(row.original.oddsEstimated) }}
                        </span>
                      </dd>
                    </div>
                    <div v-if="row.original.oddsNote">
                      <dt class="text-[11.5px] text-muted">Odds note</dt>
                      <dd class="max-w-[62ch] text-[13px] leading-relaxed text-ink-2">
                        {{ row.original.oddsNote }}
                      </dd>
                    </div>
                    <div v-if="row.original.notes">
                      <dt class="text-[11.5px] text-muted">Notes</dt>
                      <dd class="max-w-[62ch] text-[13px] leading-relaxed text-ink-2">
                        {{ row.original.notes }}
                      </dd>
                    </div>
                    <div v-if="row.original.sourceUrl">
                      <dt class="text-[11.5px] text-muted">Result source</dt>
                      <dd class="text-[13px]">
                        <a
                          :href="row.original.sourceUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="break-all text-accent underline underline-offset-2"
                          @click.stop
                        >
                          {{ row.original.sourceUrl }}
                        </a>
                      </dd>
                    </div>
                  </dl>
                </td>
              </tr>
            </template>

            <tr v-if="rows.length === 0">
              <td :colspan="columns.length + 1" class="px-4 py-10 text-center text-muted">
                No matches fit these filters. Clear a filter to widen the view.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="border-t border-rule px-4 py-2 text-[12px] text-muted">
        {{ rows.length }} match{{ rows.length === 1 ? '' : 'es' }} shown
      </p>
    </SectionCard>
  </div>
</template>
