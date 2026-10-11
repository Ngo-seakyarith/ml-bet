<script setup lang="ts">
import { computed } from 'vue'
import TeamLogo from './ui/TeamLogo.vue'
import { shortDate } from '../lib/format'
import { winnerOf, type PlayoffSeries } from '../lib/playoffs'

const props = defineProps<{
  series: PlayoffSeries
  /** Regular-season final rank per team. */
  seeds: ReadonlyMap<string, number>
  /** Upset: the lower seed won. Revenge: the winner lost to this opponent earlier in these playoffs. */
  upset: boolean
  revenge: boolean
}>()

const winner = computed(() => winnerOf(props.series))

const sides = computed(() => [
  { team: props.series.teamA, maps: props.series.mapsA },
  { team: props.series.teamB, maps: props.series.mapsB },
])

const bestOf = computed(() => (Math.max(props.series.mapsA, props.series.mapsB) === 4 ? 'Bo7' : 'Bo5'))
</script>

<template>
  <div class="rounded-md border border-rule bg-surface shadow-[0_1px_0_var(--color-rule)]">
    <div class="flex items-center justify-between gap-2 border-b border-rule px-2.5 py-1 text-[11px] text-muted">
      <span class="tnum">{{ shortDate(series.date) }} · {{ bestOf }}</span>
      <span class="flex gap-1">
        <span v-if="upset" class="rounded bg-serious/15 px-1.5 py-px font-semibold text-serious" title="The lower regular-season seed won">Upset</span>
        <span v-if="revenge" class="rounded bg-accent/15 px-1.5 py-px font-semibold text-accent" title="Beat a team that beat them earlier in these playoffs">Revenge</span>
      </span>
    </div>
    <div
      v-for="side in sides"
      :key="side.team"
      class="flex items-center gap-2 px-2.5 py-1.5 text-[13px]"
      :class="side.team === winner ? 'font-semibold text-ink' : 'text-muted'"
    >
      <span class="tnum w-6 shrink-0 text-[11px] text-muted">#{{ seeds.get(side.team) ?? '—' }}</span>
      <TeamLogo :team="side.team" :size="18" :class="side.team === winner ? '' : 'opacity-60'" />
      <span class="min-w-0 flex-1 truncate">{{ side.team }}</span>
      <span
        class="tnum w-5 shrink-0 rounded text-center"
        :class="side.team === winner ? 'bg-good/15 text-good' : ''"
      >
        {{ side.maps }}
      </span>
    </div>
  </div>
</template>
