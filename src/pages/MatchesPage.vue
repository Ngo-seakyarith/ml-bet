<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import MatchDetails from '../components/MatchDetails.vue'
import TeamLogo from '../components/ui/TeamLogo.vue'
import { odds, shortDate } from '../lib/format'
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
])

const RIGHT_ALIGNED = new Set(['winnerOdds', 'effectiveOdds'])

/**
 * Newest matches first. The most recent weekend is the one worth looking at,
 * and it should not need a click to reach. Headers still re-sort freely.
 */
const table = useTable({
  features,
  columns,
  data: filtered,
  initialState: { sorting: [{ id: 'date', desc: true }] },
})

/**
 * Phones have no column headers to tap, so sorting is a single dropdown that
 * drives the same table sorting state.
 */
const SORTS = [
  { value: 'date-desc', label: 'Newest first', id: 'date', desc: true },
  { value: 'date-asc', label: 'Oldest first', id: 'date', desc: false },
  { value: 'win-asc', label: 'Biggest favourite first', id: 'winnerOdds', desc: false },
  { value: 'win-desc', label: 'Biggest underdog first', id: 'winnerOdds', desc: true },
] as const
const sortChoice = ref<(typeof SORTS)[number]['value']>('date-desc')
watch(sortChoice, (value) => {
  const choice = SORTS.find((sort) => sort.value === value)
  if (choice) table.setSorting([{ id: choice.id, desc: choice.desc }])
})

/** Row expansion is local UI state, so it lives here rather than in the table. */
const expanded = ref<Set<number>>(new Set())
function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

/** On phones the extra filters fold away; search stays visible. */
const showFilters = ref(false)
const extraFilterCount = computed(() => activeFilterCount.value - (filters.search.trim() ? 1 : 0))

const rows = computed(() => table.getRowModel().rows)

/** Estimated prices are flagged so a backtest ROI is never mistaken for real. */
function qualityClass(quality: string): string {
  return quality === 'estimated' ? 'text-serious' : 'text-muted'
}

/** A card's left edge shows how the 2-0 bet ended, next to the W/L badge. */
function cardEdge(bet: Bet): string {
  if (bet.strategyResult === 'W') return 'border-l-good'
  if (bet.strategyResult === 'L') return 'border-l-critical'
  return 'border-l-rule-strong'
}

/* Controls are 40px tall on phones (easy to tap) and compact on desktop. */
const FIELD =
  'min-h-10 w-full rounded border border-rule bg-surface px-2 text-[14px] text-ink md:min-h-0 md:w-auto md:py-1 md:text-[12.5px]'
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard title="Matches" note="Tap a match to see its notes, price history and source.">
      <template #actions>
        <button
          v-if="activeFilterCount > 0"
          type="button"
          class="min-h-9 rounded border border-rule px-2.5 text-[12.5px] text-ink-2 hover:bg-sunken"
          @click="resetFilters"
        >
          Clear {{ activeFilterCount }} filter{{ activeFilterCount === 1 ? '' : 's' }}
        </button>
      </template>

      <div class="border-b border-rule px-3 py-3 sm:px-4">
        <!-- Search, plus the phone-only sort and filter controls, in one row. -->
        <div class="flex flex-wrap items-end gap-2">
          <label class="flex min-w-0 flex-1 flex-col gap-1 md:flex-none">
            <span class="text-[11.5px] text-muted">Search</span>
            <input
              v-model="filters.search"
              type="search"
              placeholder="Team, league or note"
              :class="[FIELD, 'md:w-48']"
            />
          </label>
          <button
            type="button"
            class="min-h-10 shrink-0 rounded border px-3 text-[13.5px] md:hidden"
            :class="
              showFilters || extraFilterCount > 0
                ? 'border-accent bg-accent/10 font-semibold text-accent'
                : 'border-rule text-ink-2'
            "
            :aria-expanded="showFilters"
            aria-controls="match-filters"
            @click="showFilters = !showFilters"
          >
            Filters{{ extraFilterCount > 0 ? ` (${extraFilterCount})` : '' }}
          </button>
        </div>

        <label class="mt-2 flex items-center gap-2 md:hidden">
          <span class="text-[11.5px] text-muted">Sort</span>
          <select v-model="sortChoice" :class="FIELD">
            <option v-for="sort in SORTS" :key="sort.value" :value="sort.value">{{ sort.label }}</option>
          </select>
        </label>

        <!-- The other filters: always shown on desktop, folded on phones. -->
        <div
          id="match-filters"
          class="mt-3 grid-cols-2 gap-2 md:mt-3 md:flex md:flex-wrap md:items-end"
          :class="showFilters ? 'grid' : 'hidden'"
        >
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">League</span>
            <select v-model="filters.league" :class="FIELD">
              <option :value="ALL">All</option>
              <option v-for="league in leagues" :key="league" :value="league">{{ league }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Odds group</span>
            <select v-model="filters.oddsGroup" :class="FIELD">
              <option :value="ALL">All</option>
              <option v-for="group in ODDS_GROUPS" :key="group.id" :value="group.id">
                {{ group.label }}
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Market</span>
            <select v-model="filters.market" :class="FIELD">
              <option :value="ALL">All</option>
              <option value="2-0">2-0</option>
              <option value="Over 2.5">Over 2.5</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Winner</span>
            <select v-model="filters.winnerResult" :class="FIELD">
              <option :value="ALL">All</option>
              <option value="W">Won</option>
              <option value="L">Lost</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Strategy</span>
            <select v-model="filters.strategyResult" :class="FIELD">
              <option :value="ALL">All</option>
              <option value="W">Won</option>
              <option value="L">Lost</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Price</span>
            <select v-model="filters.oddsQuality" :class="FIELD">
              <option :value="ALL">All</option>
              <option value="observed">Observed</option>
              <option value="estimated">Estimated</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Map score</span>
            <select v-model="filters.sweep" :class="FIELD">
              <option :value="ALL">All</option>
              <option value="sweep">2-0 sweeps</option>
              <option value="decider">Went to game 3</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Team</span>
            <select v-model="filters.team" :class="FIELD">
              <option :value="ALL">All</option>
              <option v-for="team in teams" :key="team" :value="team">{{ team }}</option>
            </select>
          </label>
        </div>
      </div>

      <!-- Phones: one card per match, everything visible without sideways scrolling. -->
      <ul class="divide-y divide-rule md:hidden">
        <li v-for="row in rows" :key="row.id">
          <button
            type="button"
            class="block w-full border-l-4 px-3 py-3 text-left active:bg-sunken"
            :class="cardEdge(row.original)"
            :aria-expanded="expanded.has(row.original.id)"
            @click="toggle(row.original.id)"
          >
            <p class="tnum text-[12px] text-muted">
              {{ shortDate(row.original.date) }} · {{ row.original.league }}
              <template v-if="row.original.oddsGroup"> · {{ row.original.oddsGroup }}</template>
            </p>
            <p class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] leading-snug">
              <TeamLogo :team="row.original.selectedTeam" :size="22" />
              <span class="font-semibold text-ink">{{ row.original.selectedTeam }}</span>
              <span class="text-muted">vs</span>
              <TeamLogo :team="row.original.opponent" :size="22" />
              <span class="text-ink-2">{{ row.original.opponent }}</span>
            </p>

            <div class="mt-2.5 grid grid-cols-3 gap-2">
              <div>
                <p class="text-[11px] text-muted">Score</p>
                <p class="tnum text-[15px] font-semibold text-ink">{{ row.original.score || '—' }}</p>
              </div>
              <div>
                <p class="text-[11px] text-muted">Winner</p>
                <p class="flex items-center gap-1.5">
                  <ResultBadge :result="row.original.winnerResult" compact />
                  <span class="tnum text-[13px] text-ink-2">{{ odds(row.original.winnerOdds) }}</span>
                </p>
              </div>
              <div>
                <p class="text-[11px] text-muted">{{ row.original.market }}</p>
                <p class="flex items-center gap-1.5">
                  <ResultBadge :result="row.original.strategyResult" compact />
                  <span class="tnum text-[13px] text-ink-2">{{ odds(row.original.effectiveOdds) }}</span>
                </p>
                <p
                  v-if="row.original.oddsQuality === 'estimated'"
                  class="text-[10.5px]"
                  :class="qualityClass(row.original.oddsQuality)"
                >
                  Estimated
                </p>
              </div>
            </div>
          </button>
          <div v-if="expanded.has(row.original.id)" class="border-l-4 border-l-transparent bg-sunken px-3 py-3">
            <MatchDetails :bet="row.original" />
          </div>
        </li>
        <li v-if="rows.length === 0" class="px-4 py-10 text-center text-[13px] text-muted">
          No matches fit these filters. Clear a filter to widen the view.
        </li>
      </ul>

      <!-- Desktop: the full sortable table. -->
      <div class="scroll-x hidden md:block">
        <table class="w-full min-w-[900px] border-collapse text-[13px]">
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
                  <span class="inline-flex items-center gap-2">
                    <TeamLogo :team="row.original.selectedTeam" />
                    {{ row.original.selectedTeam }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-2 text-ink-2">
                  <span class="inline-flex items-center gap-2">
                    <TeamLogo :team="row.original.opponent" />
                    {{ row.original.opponent }}
                  </span>
                </td>
                <td class="tnum px-3 py-2 text-right">{{ odds(row.original.winnerOdds) }}</td>
                <td class="tnum px-3 py-2 text-right">
                  {{ odds(row.original.effectiveOdds) }}
                  <span
                    v-if="row.original.oddsQuality === 'estimated'"
                    class="ml-1 text-[10.5px]"
                    :class="qualityClass(row.original.oddsQuality)"
                  >
                    Estimated
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
              </tr>

              <tr v-if="expanded.has(row.original.id)" class="border-b border-rule bg-sunken">
                <td :colspan="columns.length + 1" class="px-4 py-3">
                  <MatchDetails :bet="row.original" />
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
