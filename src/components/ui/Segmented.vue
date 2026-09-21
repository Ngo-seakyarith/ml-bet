<script setup lang="ts" generic="T extends string">
defineProps<{
  options: readonly { value: T; label: string; hint?: string }[]
  label: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="flex flex-col gap-1">
    <span class="text-[11.5px] text-muted">{{ label }}</span>
    <div class="inline-flex rounded border border-rule bg-surface p-0.5" role="group" :aria-label="label">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="rounded-[3px] px-2.5 py-1 text-[12.5px] font-medium transition-colors"
        :class="
          model === option.value
            ? 'bg-accent text-white'
            : 'text-ink-2 hover:bg-sunken'
        "
        :aria-pressed="model === option.value"
        :title="option.hint"
        @click="model = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
