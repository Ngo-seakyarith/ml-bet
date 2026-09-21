<script setup lang="ts">
import { computed } from 'vue'
import type { Interval } from '../../lib/stats'
import { percent } from '../../lib/format'

const props = defineProps<{
  value: number | null
  interval: Interval | null
  /** Renders larger under the hero figure. */
  size?: 'sm' | 'lg'
}>()

/**
 * Draws the Wilson interval on a 0–100% track. The point estimate is a tick;
 * the band is how much the sample actually pins it down. A wide band next to a
 * flattering headline is the honest version of that headline.
 */
const geometry = computed(() => {
  if (props.value === null || props.interval === null) return null
  const low = Math.max(0, Math.min(1, props.interval.low))
  const high = Math.max(0, Math.min(1, props.interval.high))
  return {
    left: `${low * 100}%`,
    width: `${Math.max(high - low, 0.004) * 100}%`,
    tick: `${Math.max(0, Math.min(1, props.value)) * 100}%`,
    label: `95% confidence interval ${percent(low)} to ${percent(high)}`,
  }
})

const tall = computed(() => (props.size === 'lg' ? 'h-2' : 'h-1.5'))
</script>

<template>
  <div v-if="geometry" class="w-full">
    <div
      class="relative w-full rounded-full bg-sunken"
      :class="tall"
      role="img"
      :aria-label="geometry.label"
      :title="geometry.label"
    >
      <div
        class="absolute inset-y-0 rounded-full bg-accent/25"
        :style="{ left: geometry.left, width: geometry.width }"
      />
      <div
        class="absolute inset-y-[-2px] w-[2px] rounded-full bg-accent"
        :style="{ left: geometry.tick }"
      />
    </div>
    <p
      v-if="size === 'lg'"
      class="tnum mt-2 text-[12.5px] text-ink-2"
    >
      95% interval {{ percent(interval!.low) }} – {{ percent(interval!.high) }}
    </p>
  </div>
</template>
