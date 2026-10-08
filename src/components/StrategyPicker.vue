<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDataset } from '../composables/useDataset'
import { GROUPS } from '../lib/strategies'

/**
 * The one control that decides which bets a page's returns are for. Shared
 * across pages, so picking "Under 2.5" here also changes Leagues and Weeks.
 */
const { strategies, strategyId, strategy } = useDataset()

const grouped = computed(() =>
  GROUPS.map((group) => ({
    ...group,
    items: strategies.value.filter((s) => s.group === group.id),
  })).filter((group) => group.items.length > 0),
)
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-rule bg-surface px-4 py-2.5">
    <label class="flex items-center gap-2">
      <span class="text-[12.5px] font-medium text-ink-2">Strategy</span>
      <select
        v-model="strategyId"
        class="min-h-10 rounded border border-rule bg-surface px-2 text-[14px] font-semibold text-ink lg:min-h-0 lg:py-1.5 lg:text-[13px]"
      >
        <optgroup v-for="group in grouped" :key="group.id" :label="group.heading">
          <option v-for="item in group.items" :key="item.id" :value="item.id">{{ item.label }}</option>
        </optgroup>
      </select>
    </label>
    <p class="order-last min-w-0 basis-full text-[12.5px] text-muted sm:order-none sm:basis-0 sm:flex-1">
      {{ strategy.describe }}
    </p>
    <RouterLink :to="{ name: 'strategies' }" class="ml-auto text-[12.5px] font-medium text-accent hover:underline sm:ml-0">
      Compare all
    </RouterLink>
  </div>
</template>
