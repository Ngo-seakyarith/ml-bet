<script setup lang="ts">
import { computed } from 'vue'
import TeamLogo from './ui/TeamLogo.vue'
import { heroImage } from '../lib/heroes'
import { shortDate } from '../lib/format'
import type { GameDetail, TeamGame } from '../lib/standings'

/** One series opened from a result box: every game with stats and both lineups. */
const props = defineProps<{
  team: string
  game: TeamGame
}>()
defineEmits<{ close: [] }>()

const played = computed(() => props.game.mapsFor !== null && props.game.mapsAgainst !== null)
const won = computed(() => played.value && (props.game.mapsFor ?? 0) > (props.game.mapsAgainst ?? 0))
const games = computed(() => [...(props.game.details ?? [])].sort((a, b) => a.game - b.game))

/** Stats shown per team, in this order, when the league records them. */
const STATS: readonly { key: 'kills' | 'lords' | 'turtles' | 'towers'; label: string }[] = [
  { key: 'kills', label: 'Kills' },
  { key: 'lords', label: 'Lords' },
  { key: 'turtles', label: 'Turtles' },
  { key: 'towers', label: 'Towers' },
]

function sides(g: GameDetail) {
  return [
    { team: props.team, index: 0 as const },
    { team: props.game.opponent, index: 1 as const },
  ].map((s) => ({
    ...s,
    won: g.winner === s.team,
    stats: STATS.filter((st) => g[st.key] !== null).map((st) => ({ label: st.label, value: g[st.key]![s.index] })),
    picks: g.picks[s.index],
  }))
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- The series -->
    <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
      <span class="tnum text-muted">Week {{ game.week }} · {{ shortDate(game.date) }}</span>
      <TeamLogo :team="team" :size="18" />
      <span class="font-semibold text-ink">{{ team }}</span>
      <span
        v-if="played"
        class="tnum rounded px-1.5 py-0.5 font-bold text-white"
        :class="won ? 'bg-good' : 'bg-critical'"
      >
        {{ game.mapsFor }}-{{ game.mapsAgainst }}
      </span>
      <span v-else class="text-muted">v</span>
      <TeamLogo :team="game.opponent" :size="18" />
      <span class="font-semibold text-ink">{{ game.opponent }}</span>
      <span v-if="!played" class="text-muted">· not played yet</span>
      <button type="button" class="ml-2 text-[12px] text-accent hover:underline" @click="$emit('close')">Close</button>
    </div>

    <!-- Each game -->
    <div v-if="games.length > 0" class="flex flex-wrap gap-3">
      <div
        v-for="g in games"
        :key="g.game"
        class="w-full min-w-0 rounded-md border border-rule bg-surface sm:w-[340px]"
      >
        <div class="flex items-center justify-between gap-2 border-b border-rule px-3 py-1.5 text-[12px]">
          <span class="font-semibold text-ink">Game {{ g.game }}</span>
          <span class="tnum text-muted">{{ g.duration !== null ? `${g.duration.toFixed(1)} min` : '' }}</span>
          <span
            class="rounded px-1.5 py-px text-[11px] font-bold text-white"
            :class="g.winner === team ? 'bg-good' : 'bg-critical'"
          >
            {{ g.winner === team ? 'Win' : 'Loss' }}
          </span>
        </div>
        <div
          v-for="side in sides(g)"
          :key="side.team"
          class="border-b border-rule px-3 py-2 last:border-b-0"
          :class="side.won ? '' : 'opacity-75'"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span class="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              <TeamLogo :team="side.team" :size="16" />
              <span class="truncate">{{ side.team }}</span>
            </span>
            <span v-for="st in side.stats" :key="st.label" class="tnum text-[11.5px] text-muted">
              {{ st.label }} <span class="font-semibold text-ink">{{ st.value }}</span>
            </span>
          </div>
          <div class="mt-1.5 grid grid-cols-5 gap-1">
            <div v-for="(p, i) in side.picks" :key="i" class="flex min-w-0 flex-col items-center" :title="`${p.player}: ${p.hero}`">
              <img
                v-if="heroImage(p.hero)"
                :src="heroImage(p.hero)!"
                :alt="p.hero"
                loading="lazy"
                class="h-9 w-9 rounded-md border border-rule object-cover"
              />
              <span v-else class="flex h-9 w-9 items-center justify-center rounded-md border border-rule bg-sunken text-[9px] text-muted">
                {{ p.hero.slice(0, 4) }}
              </span>
              <span class="mt-0.5 w-full truncate text-center text-[10.5px] text-ink-2">{{ p.player || '—' }}</span>
              <span class="w-full truncate text-center text-[10px] text-muted">{{ p.hero }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p v-else-if="played" class="text-[12.5px] text-muted">No game-by-game detail for this league yet.</p>
  </div>
</template>
