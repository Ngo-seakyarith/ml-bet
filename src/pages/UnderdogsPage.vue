<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDataset } from '../composables/useDataset'
import {
  marginPercent,
  measureMargins,
  summarizeUnderdogs,
  underdogBets,
  type UnderdogBet,
} from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import StatTile from '../components/ui/StatTile.vue'
import ConfidenceMark from '../components/ui/ConfidenceMark.vue'
import ResultBadge from '../components/ui/ResultBadge.vue'
import TeamLogo from '../components/ui/TeamLogo.vue'
import { odds, percent, shortDate, shortWeek, signedPercent, toneFor, units } from '../lib/format'

const { scoped, allBets } = useDataset()

/**
 * Margins are measured from every recorded odds pair in the CSV (upcoming
 * matches included, filters ignored), so each new pair refines the estimates.
 */
const margins = computed(() => measureMargins(allBets.value))

const dogs = computed(() => underdogBets(scoped.value, (league) => margins.value(league).margin))

/** One card per league, busiest first. */
const leagues = computed(() => {
  const byLeague = new Map<string, UnderdogBet[]>()
  for (const item of dogs.value) {
    const list = byLeague.get(item.bet.league)
    if (list) list.push(item)
    else byLeague.set(item.bet.league, [item])
  }
  return [...byLeague.entries()]
    .map(([league, list]) => ({ league, list, summary: summarizeUnderdogs(list) }))
    .sort((a, b) => b.list.length - a.list.length)
})

/** The league whose detail is shown below the cards. MPL ID by default, where the idea came from. */
const selected = ref('MPL ID')
watch(
  leagues,
  (list) => {
    if (!list.some((item) => item.league === selected.value) && list[0]) selected.value = list[0].league
  },
  { immediate: true },
)

const current = computed(() => leagues.value.find((item) => item.league === selected.value) ?? null)
const picked = computed(() => summarizeUnderdogs(current.value?.list.filter((item) => item.picked) ?? []))
const skipped = computed(() => summarizeUnderdogs(current.value?.list.filter((item) => !item.picked) ?? []))

/** Weekend by weekend for the selected league, oldest first. */
const weekends = computed(() => {
  const byWeek = new Map<string, { first: string; list: UnderdogBet[] }>()
  for (const item of current.value?.list ?? []) {
    const entry = byWeek.get(item.bet.week)
    if (entry) {
      entry.list.push(item)
      if (item.bet.date < entry.first) entry.first = item.bet.date
    } else {
      byWeek.set(item.bet.week, { first: item.bet.date, list: [item] })
    }
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[1].first.localeCompare(b[1].first))
    .map(([week, entry]) => ({ week, summary: summarizeUnderdogs(entry.list) }))
})

/** Newest first, like the Matches page. */
const matches = computed(() =>
  [...(current.value?.list ?? [])].sort((a, b) =>
    a.bet.date === b.bet.date ? b.bet.id - a.bet.id : b.bet.date.localeCompare(a.bet.date),
  ),
)

/** The margin behind the selected league's estimates, and where it came from. */
const marginNote = computed(() => {
  if (!current.value) return ''
  const league = current.value.league
  const m = margins.value(league)
  const value = marginPercent(m.margin)
  const from =
    m.source === 'league'
      ? `measured from ${m.samples} ${league} match${m.samples === 1 ? '' : 'es'} with both odds recorded`
      : m.source === 'domestic'
        ? `no ${league} match has both odds yet, so measured from ${m.samples} other league match${m.samples === 1 ? '' : 'es'}`
        : 'no recorded pairs yet, so taken from earlier screenshots'
  return `Prices marked ~ had no opponent Match Winner price in the CSV, so they are estimated using a bookmaker margin of ${value} (${from}).`
})

function toneClass(value: number | null): string {
  const tone = toneFor(value)
  return tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-critical' : 'text-ink'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard
      title="Backing every underdog"
      note="One unit on the longer-priced team to win, in every match. Tap a league to see its detail."
    >
      <div v-if="leagues.length === 0" class="px-4 py-10 text-center text-[13px] text-muted">
        No settled matches in this selection. Widen the weekend filter.
      </div>
      <!--
        Dividers are drawn by each card's right/bottom border; the outer edge
        ones are clipped away, so an uneven last row leaves no empty block.
      -->
      <div v-else class="overflow-hidden rounded-b-md">
      <ul class="-mb-px -mr-px grid sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="item in leagues" :key="item.league" class="border-b border-r border-rule bg-surface">
          <button
            type="button"
            class="block h-full w-full px-4 py-3.5 text-left transition-colors"
            :class="item.league === selected ? 'bg-accent/8 ring-2 ring-inset ring-accent' : 'hover:bg-sunken'"
            :aria-pressed="item.league === selected"
            @click="selected = item.league"
          >
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-[14px] font-semibold text-ink">{{ item.league }}</span>
              <span class="tnum text-[22px] font-semibold leading-none" :class="toneClass(item.summary.roi)">
                {{ signedPercent(item.summary.roi, 0) }}
              </span>
            </div>
            <p class="tnum mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-2">
              Won {{ item.summary.wins }} of {{ item.summary.n }} ({{ percent(item.summary.hitRate, 0) }})
              <ConfidenceMark :confidence="item.summary.confidence" :n="item.summary.n" unit="matches" />
            </p>
            <p class="tnum mt-0.5 text-[12.5px] text-muted">
              Needs {{ percent(item.summary.breakEven, 0) }} to break even ·
              <span :class="toneClass(item.summary.profit)">{{ units(item.summary.profit) }} units</span>
            </p>
          </button>
        </li>
      </ul>
      </div>
    </SectionCard>

    <template v-if="current">
      <SectionCard
        :title="`${current.league}: your picks vs the rest`"
        note="Underdogs you picked yourself, against the ones where you backed the favourite instead."
      >
        <div class="stat-grid" data-flush>
          <StatTile
            label="Underdogs you picked"
            :value="signedPercent(picked.roi, 0)"
            :support="`${picked.wins} of ${picked.n} won · ${units(picked.profit)} units`"
            :tone="toneFor(picked.roi)"
            :confidence="picked.confidence"
            :n="picked.n"
            unit="matches"
          />
          <StatTile
            label="Underdogs you skipped"
            :value="signedPercent(skipped.roi, 0)"
            :support="`${skipped.wins} of ${skipped.n} won · ${units(skipped.profit)} units`"
            :tone="toneFor(skipped.roi)"
            :confidence="skipped.confidence"
            :n="skipped.n"
            unit="matches"
          />
        </div>
      </SectionCard>

      <SectionCard :title="`${current.league} by weekend`">
        <ul class="divide-y divide-rule">
          <li
            v-for="weekend in weekends"
            :key="weekend.week"
            class="tnum flex items-baseline gap-3 px-4 py-2.5 text-[13px]"
          >
            <span class="w-24 shrink-0 font-medium text-ink">{{ shortWeek(weekend.week) }}</span>
            <span class="text-ink-2">
              won {{ weekend.summary.wins }} of {{ weekend.summary.n }}
            </span>
            <span class="ml-auto font-semibold" :class="toneClass(weekend.summary.profit)">
              {{ units(weekend.summary.profit) }} u
            </span>
          </li>
        </ul>
      </SectionCard>

      <SectionCard
        :title="`Every ${current.league} underdog`"
        :note="marginNote"
      >
        <ul class="divide-y divide-rule">
          <li v-for="item in matches" :key="item.bet.id" class="flex items-center gap-3 px-4 py-2.5">
            <ResultBadge :result="item.won ? 'W' : 'L'" compact />
            <div class="min-w-0 flex-1">
              <p class="flex min-w-0 items-center gap-1.5 text-[14px]">
                <TeamLogo :team="item.team" :size="18" />
                <span class="truncate font-semibold text-ink">{{ item.team }}</span>
                <span class="shrink-0 text-muted">vs</span>
                <TeamLogo :team="item.opponent" :size="18" />
                <span class="truncate text-ink-2">{{ item.opponent }}</span>
              </p>
              <p class="tnum text-[12px] text-muted">
                {{ shortDate(item.bet.date) }} · @{{ item.estimated ? '~' : '' }}{{ odds(item.odds) }}
                <template v-if="item.bet.score"> · {{ item.bet.score }} for {{ item.bet.selectedTeam }}</template>
                <span
                  v-if="item.picked"
                  class="ml-1 rounded bg-accent/12 px-1.5 py-0.5 text-[11px] font-medium text-accent"
                >
                  your pick
                </span>
              </p>
            </div>
            <span class="tnum shrink-0 text-[14px] font-semibold" :class="toneClass(item.profit)">
              {{ units(item.profit) }}
            </span>
          </li>
        </ul>
      </SectionCard>

      <p class="px-1 text-[12px] leading-relaxed text-muted">
        These are Match Winner bets on the underdog, not 2-0 bets. Small samples swing a lot: a
        hollow or half marker means too few matches to rely on. Fill in opponent_match_winner_odds when you take
        a snapshot and that match uses the real price instead of an estimate.
      </p>
    </template>
  </div>
</template>
