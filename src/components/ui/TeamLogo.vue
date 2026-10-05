<script setup lang="ts">
import { computed, ref } from 'vue'
import { initialsFor, logoFor } from '../../lib/teams'

const props = withDefaults(defineProps<{ team: string; size?: number }>(), { size: 20 })

const entry = computed(() => logoFor(props.team))
/** If a file fails to load, fall back to initials rather than a broken image. */
const failed = ref(false)

/* Flags keep a 3:2-ish box (shorter, wider); logos are square. */
const box = computed(() =>
  entry.value?.shape === 'flag' && !failed.value
    ? { width: `${Math.round(props.size * 1.3)}px`, height: `${Math.round(props.size * 0.85)}px` }
    : { width: `${props.size}px`, height: `${props.size}px` },
)
</script>

<template>
  <!-- Decorative: the team name always sits next to it, so screen readers skip the logo. -->
  <span
    class="team-logo inline-flex shrink-0 items-center justify-center overflow-hidden"
    :class="[
      entry && !failed ? (entry.shape === 'flag' ? 'rounded-[2px]' : 'rounded') : 'rounded-full bg-sunken',
      entry?.ink === 'light' && !failed ? 'tile-dark p-[2px]' : '',
      entry?.ink === 'dark' && !failed ? 'tile-light p-[2px]' : '',
    ]"
    :style="box"
    aria-hidden="true"
  >
    <!-- A <picture> lets the browser pick the dark-mode file when one exists. -->
    <picture v-if="entry && !failed" class="contents">
      <source v-if="entry.darkSrc" :srcset="entry.darkSrc" media="(prefers-color-scheme: dark)" />
      <img
        :src="entry.src"
        alt=""
        loading="lazy"
        decoding="async"
        class="h-full w-full"
        :class="entry.shape === 'flag' ? 'object-cover' : 'object-contain'"
        @error="failed = true"
      />
    </picture>
    <span
      v-else
      class="font-semibold leading-none text-ink-2"
      :style="{ fontSize: `${Math.max(8, Math.round(size * 0.4))}px` }"
    >
      {{ initialsFor(team) }}
    </span>
  </span>
</template>

<style scoped>
/* Fixed tiles, independent of theme, so one-colour logos stay visible in both. */
.tile-dark {
  background: #1a1a19;
}
.tile-light {
  background: #f2f1ec;
}
</style>
