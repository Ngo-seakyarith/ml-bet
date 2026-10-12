<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { measureMargins, otherSideOdds } from '../lib/stats'
import { odds, percent, shortDate } from '../lib/format'
import SectionCard from './ui/SectionCard.vue'
import TeamLogo from './ui/TeamLogo.vue'

/**
 * This season's upsets: finished matches where the bookmaker's favourite lost.
 * Needs prices, so it reads the betting CSV (predicted prices included); past
 * seasons have no odds and show nothing.
 */
const props = defineProps<{
  league: string
  /** Only matches up to this week; null for the whole season. */
  throughWeek: number | null
}>()

const { allBets } = useDataset()
const margins = computed(() => measureMargins(allBets.value))

const weekOf = (officialWeek: string) => Number(/\d+/.exec(officialWeek)?.[0] ?? 0)

const priced = computed(() =>
  allBets.value
    .filter(
      (b) =>
        b.league === props.league &&
        b.winnerOdds !== null &&
        b.selectedMaps !== null &&
        b.opponentMaps !== null &&
        (props.throughWeek === null || weekOf(b.officialWeek) <= props.throughWeek),
    )
    .flatMap((b) => {
      const theirs = b.opponentOdds ?? otherSideOdds(b.winnerOdds!, margins.value(b.league).margin)
      if (theirs === null) return []
      const selFav = b.winnerOdds! <= theirs
      const [favMaps, dogMaps] = selFav ? [b.selectedMaps!, b.opponentMaps!] : [b.opponentMaps!, b.selectedMaps!]
      return [
        {
          id: b.id,
          date: b.date,
          week: weekOf(b.officialWeek),
          fav: selFav ? b.selectedTeam : b.opponent,
          dog: selFav ? b.opponent : b.selectedTeam,
          favPrice: selFav ? b.winnerOdds! : theirs,
          dogPrice: selFav ? theirs : b.winnerOdds!,
          score: `${favMaps}-${dogMaps}`,
          favWon: favMaps > dogMaps,
        },
      ]
    }),
)

const upsets = computed(() => priced.value.filter((m) => !m.favWon).sort((a, b) => a.date.localeCompare(b.date)))
const favWins = computed(() => priced.value.length - upsets.value.length)
const close = computed(() => upsets.value.filter((m) => m.score === '1-2').length)
</script>

<template>
  <SectionCard
    v-if="priced.length > 0"
    title="Upsets this season"
    :note="`Matches where the bookmaker's favourite lost, from the ${priced.length} priced ${league} matches in the betting CSV. Score is from the favourite's side.`"
  >
    <div class="flex flex-wrap gap-x-6 gap-y-1 border-b border-rule px-4 py-2.5 text-[13px] text-ink-2">
      <span>
        Favourites
        <span class="tnum font-semibold text-ink">{{ favWins }}-{{ upsets.length }}</span>
        ({{ percent(favWins / priced.length, 0) }})
      </span>
      <span v-if="upsets.length > 0">
        <span class="tnum font-semibold text-ink">{{ close }} of {{ upsets.length }}</span> upsets went to three maps
      </span>
    </div>

    <div class="scroll-x">
      <table class="w-full min-w-[620px] border-collapse whitespace-nowrap text-[13px]">
        <thead>
          <tr class="border-b border-rule-strong text-left">
            <th class="px-4 py-2 font-medium text-ink-2">Date</th>
            <th class="px-3 py-2 text-right font-medium text-ink-2">Week</th>
            <th class="px-3 py-2 font-medium text-ink-2">Favourite</th>
            <th class="px-3 py-2 text-right font-medium text-ink-2">Price</th>
            <th class="px-3 py-2 font-medium text-ink-2">Lost to</th>
            <th class="px-3 py-2 text-right font-medium text-ink-2">Price</th>
            <th class="px-3 py-2 text-right font-medium text-ink-2">Score</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in upsets" :key="m.id" class="border-b border-rule last:border-b-0">
            <td class="tnum px-4 py-2 text-ink-2">{{ shortDate(m.date) }}</td>
            <td class="tnum px-3 py-2 text-right text-ink-2">{{ m.week }}</td>
            <td class="px-3 py-2 text-muted">
              <span class="inline-flex items-center gap-2"><TeamLogo :team="m.fav" :size="18" class="opacity-60" />{{ m.fav }}</span>
            </td>
            <td class="tnum px-3 py-2 text-right text-muted">{{ odds(m.favPrice) }}</td>
            <td class="px-3 py-2 font-semibold text-ink">
              <span class="inline-flex items-center gap-2"><TeamLogo :team="m.dog" :size="18" />{{ m.dog }}</span>
            </td>
            <td class="tnum px-3 py-2 text-right font-semibold text-ink">{{ odds(m.dogPrice) }}</td>
            <td class="tnum px-3 py-2 text-right" :class="m.score === '1-2' ? 'text-ink-2' : 'font-semibold text-critical'">
              {{ m.score }}
            </td>
          </tr>
          <tr v-if="upsets.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-muted">No upsets in this range: every favourite won.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </SectionCard>
</template>
