<script setup lang="ts">
defineProps<{
  title: string
  /** One plain sentence saying what the reader is looking at. */
  note?: string
}>()
</script>

<template>
  <section class="rounded-md border border-rule bg-surface">
    <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-3">
      <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-ink">{{ title }}</h2>
      <p v-if="note" class="max-w-[62ch] text-[12.5px] leading-snug text-muted">{{ note }}</p>
      <slot name="actions" />
    </header>
    <div>
      <slot />
    </div>
  </section>
</template>
