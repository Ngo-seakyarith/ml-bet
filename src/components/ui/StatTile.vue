<script setup lang="ts">
import { computed } from 'vue'
import ConfidenceMark from './ConfidenceMark.vue'
import type { Confidence } from '../../lib/stats'

const props = defineProps<{
  label: string
  value: string
  /** Fraction or record behind the headline figure. */
  support?: string
  tone?: 'good' | 'bad' | 'flat'
  confidence?: Confidence
  n?: number
  unit?: string
}>()

const valueClass = computed(() => {
  switch (props.tone) {
    case 'good':
      return 'text-good'
    case 'bad':
      return 'text-critical'
    default:
      return 'text-ink'
  }
})
</script>

<template>
  <div class="flex flex-col gap-1 border-b border-rule px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
    <div class="flex items-center gap-1.5">
      <span class="text-[12.5px] text-ink-2">{{ label }}</span>
      <ConfidenceMark v-if="confidence && n !== undefined" :confidence="confidence" :n="n" :unit="unit" />
    </div>
    <span class="tnum text-[26px] font-semibold leading-none tracking-[-0.02em]" :class="valueClass">
      {{ value }}
    </span>
    <span v-if="support" class="tnum text-[12px] text-muted">{{ support }}</span>
  </div>
</template>
