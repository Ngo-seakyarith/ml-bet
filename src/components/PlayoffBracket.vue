<script setup lang="ts">
import { computed } from 'vue'
import SectionCard from './ui/SectionCard.vue'
import BracketMatch from './BracketMatch.vue'
import { playoffSeries, winnerOf, type PlayoffRound, type PlayoffSeries } from '../lib/playoffs'

const props = defineProps<{
  league: string
  season: number
  /** Regular-season final rank per team, used as the seed. */
  seeds: ReadonlyMap<string, number>
}>()

const series = computed(() => playoffSeries.filter((s) => s.league === props.league && s.season === props.season))
const inRound = (round: PlayoffRound) => series.value.filter((s) => s.round === round)

const final = computed(() => inRound('Grand Final')[0] ?? null)

const keyOf = (s: PlayoffSeries) => `${s.round}|${s.teamA}|${s.teamB}`

/**
 * Two kinds of surprise per series:
 * - upset: the lower regular-season seed won;
 * - revenge: the winner had lost to this same opponent earlier in these
 *   playoffs (e.g. beaten in the upper semifinal, then won the lower final).
 */
const tags = computed(() => {
  const out = new Map<string, { upset: boolean; revenge: boolean }>()
  for (const s of series.value) {
    const a = props.seeds.get(s.teamA)
    const b = props.seeds.get(s.teamB)
    const winner = winnerOf(s)
    const upset = a !== undefined && b !== undefined && winner !== (a < b ? s.teamA : s.teamB)
    const loser = winner === s.teamA ? s.teamB : s.teamA
    const revenge = series.value.some(
      (e) => e.date < s.date && winnerOf(e) === loser && (e.teamA === winner || e.teamB === winner),
    )
    out.set(keyOf(s), { upset, revenge })
  }
  return out
})
const tagOf = (s: PlayoffSeries) => tags.value.get(keyOf(s)) ?? { upset: false, revenge: false }
const upsets = computed(() => [...tags.value.values()].filter((t) => t.upset).length)
const revenges = computed(() => [...tags.value.values()].filter((t) => t.revenge).length)

/** Upper row left to right; the lower row sits under the middle two columns. */
const UPPER: readonly { round: PlayoffRound; title: string }[] = [
  { round: 'Play-in', title: 'Play-in' },
  { round: 'Upper Bracket Semifinal', title: 'Upper semifinals' },
  { round: 'Upper Bracket Final', title: 'Upper final' },
]
const LOWER: readonly { round: PlayoffRound; title: string }[] = [
  { round: 'Lower Bracket Semifinal', title: 'Lower semifinal' },
  { round: 'Lower Bracket Final', title: 'Lower final' },
]
</script>

<template>
  <SectionCard
    v-if="series.length > 0"
    title="Playoff bracket"
    note="# is the regular-season seed. Upset: the lower seed won. Revenge: beat a team that beat them earlier in these playoffs."
  >
    <p class="tnum border-b border-rule px-4 py-2.5 text-[12.5px] text-ink-2">
      {{ upsets }} upset{{ upsets === 1 ? '' : 's' }} and {{ revenges }} revenge{{ revenges === 1 ? '' : 's' }} in {{ series.length }} series
    </p>

    <div class="scroll-x">
      <div class="grid min-w-[920px] grid-cols-4 gap-x-5 gap-y-3 p-4">
        <p v-for="col in UPPER" :key="col.title" class="text-[11.5px] font-semibold uppercase tracking-wide text-muted">
          {{ col.title }}
        </p>
        <p class="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Grand final</p>

        <div v-for="col in UPPER" :key="col.round" class="flex flex-col justify-around gap-3">
          <BracketMatch v-for="s in inRound(col.round)" :key="keyOf(s)" :series="s" :seeds="seeds" v-bind="tagOf(s)" />
        </div>
        <div class="row-span-3 flex flex-col justify-center">
          <BracketMatch v-if="final" :series="final" :seeds="seeds" v-bind="tagOf(final)" />
        </div>

        <p class="mt-2 text-[11.5px] text-muted">Play-in losers are out.</p>
        <p v-for="col in LOWER" :key="col.title" class="mt-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
          {{ col.title }}
        </p>
        <div />
        <div v-for="col in LOWER" :key="col.round" class="flex flex-col gap-3">
          <BracketMatch v-for="s in inRound(col.round)" :key="keyOf(s)" :series="s" :seeds="seeds" v-bind="tagOf(s)" />
        </div>
      </div>
    </div>
    <p class="border-t border-rule px-4 py-2.5 text-[12px] leading-relaxed text-muted">
      Seeds 3–6 play the play-in; the winners meet seeds 1 and 2 in the upper semifinals. Upper
      semifinal losers meet in the lower semifinal, whose winner plays the upper final loser in the
      lower final. All series are Bo5 except the lower final and grand final (Bo7).
    </p>
  </SectionCard>
</template>
