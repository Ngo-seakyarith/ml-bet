<script setup lang="ts">
import type { Bet } from '../lib/types'
import { odds } from '../lib/format'

defineProps<{ bet: Bet }>()
</script>

<template>
  <!-- The expanded detail for one match: pick, price, notes, source. -->
  <dl class="grid gap-x-8 gap-y-3 sm:grid-cols-2">
    <div>
      <dt class="text-[11.5px] text-muted">Pick</dt>
      <dd class="text-[13px] text-ink">{{ bet.selection }}</dd>
    </div>
    <div>
      <dt class="text-[11.5px] text-muted">{{ bet.market }} price</dt>
      <dd class="tnum text-[13px] text-ink">
        <template v-if="bet.effectiveOdds !== null">
          {{ odds(bet.effectiveOdds) }}
          <span v-if="bet.oddsQuality === 'estimated'" class="text-serious">(estimated)</span>
        </template>
        <span v-else class="text-muted">Not recorded yet</span>
      </dd>
    </div>
    <div v-if="bet.oddsNote">
      <dt class="text-[11.5px] text-muted">Odds note</dt>
      <dd class="max-w-[62ch] text-[13px] leading-relaxed text-ink-2">{{ bet.oddsNote }}</dd>
    </div>
    <div v-if="bet.notes">
      <dt class="text-[11.5px] text-muted">Notes</dt>
      <dd class="max-w-[62ch] text-[13px] leading-relaxed text-ink-2">{{ bet.notes }}</dd>
    </div>
    <div v-if="bet.sourceUrl">
      <dt class="text-[11.5px] text-muted">Result source</dt>
      <dd class="text-[13px]">
        <a
          :href="bet.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="break-all text-accent underline underline-offset-2"
          @click.stop
        >
          {{ bet.sourceUrl }}
        </a>
      </dd>
    </div>
  </dl>
</template>
