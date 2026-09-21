<script setup lang="ts">
import { computed, ref } from 'vue'
import { ALL, useDataset } from './composables/useDataset'
import Segmented from './components/ui/Segmented.vue'
import DashboardPage from './pages/DashboardPage.vue'
import MatchesPage from './pages/MatchesPage.vue'
import OddsGroupsPage from './pages/OddsGroupsPage.vue'
import WeeksPage from './pages/WeeksPage.vue'
import LeaguesPage from './pages/LeaguesPage.vue'
import BankrollPage from './pages/BankrollPage.vue'
import DataPage from './pages/DataPage.vue'
import { shortWeek } from './lib/format'
import type { AnalysisMode } from './lib/types'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', component: DashboardPage },
  { id: 'matches', label: 'Matches', component: MatchesPage },
  { id: 'groups', label: 'Odds groups', component: OddsGroupsPage },
  { id: 'weeks', label: 'Weeks', component: WeeksPage },
  { id: 'leagues', label: 'Leagues', component: LeaguesPage },
  { id: 'bankroll', label: 'Bankroll', component: BankrollPage },
  { id: 'data', label: 'Data', component: DataPage },
] as const

type PageId = (typeof PAGES)[number]['id']

const current = ref<PageId>('dashboard')
const active = computed(() => PAGES.find((page) => page.id === current.value) ?? PAGES[0])

const { mode, includeBacktest, week, weeks, scoped, allBets } = useDataset()

const MODE_OPTIONS = [
  {
    value: 'research' as AnalysisMode,
    label: 'Research',
    hint: 'Every pre-match pick, including ones you skipped',
  },
  {
    value: 'real' as AnalysisMode,
    label: 'Real money',
    hint: 'Only bets you actually placed',
  },
]

/** The bankroll page is always real money, whatever the toggle says. */
const modeIgnored = computed(() => current.value === 'bankroll')

const backtestCount = computed(
  () => allBets.value.filter((bet) => bet.betStatus === 'backtest_only').length,
)
</script>

<template>
  <div class="min-h-screen bg-plane">
    <div class="mx-auto flex max-w-[1500px] flex-col lg:flex-row">
      <!-- Navigation rail -->
      <header
        class="shrink-0 border-b border-rule bg-surface lg:h-screen lg:w-56 lg:border-b-0 lg:border-r lg:sticky lg:top-0"
      >
        <div class="px-4 py-4">
          <h1 class="text-[15px] font-bold leading-tight tracking-[-0.02em] text-ink">
            MLBB Strategy Lab
          </h1>
          <p class="mt-0.5 text-[11.5px] text-muted">{{ allBets.length }} tracked matches</p>
        </div>

        <nav class="px-2 pb-3 lg:pb-4" aria-label="Sections">
          <ul class="flex flex-wrap gap-1 lg:flex-col">
            <li v-for="page in PAGES" :key="page.id">
              <button
                type="button"
                class="w-full rounded px-2.5 py-1.5 text-left text-[13px] transition-colors"
                :class="
                  current === page.id
                    ? 'bg-accent/12 font-semibold text-accent'
                    : 'text-ink-2 hover:bg-sunken'
                "
                :aria-current="current === page.id ? 'page' : undefined"
                @click="current = page.id"
              >
                {{ page.label }}
              </button>
            </li>
          </ul>
        </nav>
      </header>

      <!--
        The content column owns its own width: wide tables and plots scroll
        inside their `.scroll-x` wrappers and can never widen the document.
      -->
      <div class="min-w-0 flex-1 overflow-x-clip">
        <!-- Global controls: these scope every figure on every page. -->
        <div
          class="sticky top-0 z-10 flex flex-wrap items-end gap-4 border-b border-rule bg-plane/95 px-4 py-3 backdrop-blur lg:px-6"
        >
          <Segmented v-model="mode" label="Mode" :options="MODE_OPTIONS" />

          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Weekend</span>
            <select
              v-model="week"
              class="rounded border border-rule bg-surface px-2 py-1.5 text-[12.5px] text-ink"
            >
              <option :value="ALL">All weeks</option>
              <option v-for="label in weeks" :key="label" :value="label">
                {{ shortWeek(label) }}
              </option>
            </select>
          </label>

          <label
            v-if="mode === 'research' && backtestCount > 0"
            class="flex items-center gap-2 pb-1.5 text-[12.5px] text-ink-2"
          >
            <input v-model="includeBacktest" type="checkbox" class="accent-accent" />
            Include backtest week
            <span class="text-muted">({{ backtestCount }} rows, estimated prices)</span>
          </label>

          <p class="ml-auto pb-1.5 text-[12px] text-muted">
            <span v-if="modeIgnored">Bankroll always shows placed bets only</span>
            <span v-else class="tnum">{{ scoped.length }} rows in scope</span>
          </p>
        </div>

        <main class="px-4 py-4 lg:px-6 lg:py-5">
          <component :is="active.component" />
        </main>

        <footer class="border-t border-rule px-4 py-4 text-[12px] leading-relaxed text-muted lg:px-6">
          Flat one-unit stakes throughout. Research mode counts picks that were never backed, so
          its returns are a measure of the method, not of the account.
        </footer>
      </div>
    </div>
  </div>
</template>
