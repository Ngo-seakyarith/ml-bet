<script setup lang="ts">
import { computed } from 'vue'
import type { Confidence } from '../../lib/stats'

const props = defineProps<{
  confidence: Confidence
  n: number
  /** What the n counts, e.g. "bets" or "correct winner picks". */
  unit?: string
}>()

/**
 * Sample size is encoded twice — glyph and title text — so it never depends on
 * colour alone. A rate off six bets must not read like a rate off a hundred.
 */
const detail = computed(() => {
  const unit = props.unit ?? 'bets'
  switch (props.confidence) {
    case 'low':
      return {
        glyph: '○',
        className: 'text-critical',
        label: `Only ${props.n} ${unit} — treat as anecdote, not evidence`,
      }
    case 'moderate':
      return {
        glyph: '◐',
        className: 'text-warning',
        label: `${props.n} ${unit} — suggestive, still thin`,
      }
    default:
      return {
        glyph: '●',
        className: 'text-muted',
        label: `${props.n} ${unit}`,
      }
  }
})
</script>

<template>
  <span
    class="relative inline-flex shrink-0 cursor-help items-center text-[11px] leading-none"
    :class="detail.className"
    :title="detail.label"
  >
    <span aria-hidden="true">{{ detail.glyph }}</span>
    <span class="sr-only">{{ detail.label }}</span>
  </span>
</template>
