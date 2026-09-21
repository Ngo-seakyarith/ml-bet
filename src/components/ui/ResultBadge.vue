<script setup lang="ts">
import { computed } from 'vue'
import type { Outcome } from '../../lib/types'

const props = defineProps<{ result: Outcome; compact?: boolean }>()

/** Result carries a letter as well as a colour, never colour alone. */
const detail = computed(() => {
  switch (props.result) {
    case 'W':
      return { text: 'W', full: 'Won', className: 'bg-good/12 text-good' }
    case 'L':
      return { text: 'L', full: 'Lost', className: 'bg-critical/12 text-critical' }
    default:
      return { text: 'V', full: 'Void or postponed', className: 'bg-sunken text-muted' }
  }
})
</script>

<template>
  <span
    class="inline-flex min-w-[1.5rem] items-center justify-center rounded px-1.5 py-0.5 text-[11.5px] font-semibold"
    :class="detail.className"
    :title="detail.full"
  >
    {{ compact ? detail.text : detail.full }}
  </span>
</template>
