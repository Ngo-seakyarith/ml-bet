<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { ALL, useDataset } from './composables/useDataset'
import { PAGES as NAV } from './router'
import { shortWeek } from './lib/format'

const { includeEstimatedPrices, week, weeks, scoped, allBets } = useDataset()

/** Rows whose 2-0 price was interpolated rather than observed. */
const estimatedCount = computed(
  () => allBets.value.filter((bet) => bet.oddsQuality === 'estimated').length,
)
</script>

<template>
  <div class="min-h-screen bg-plane">
    <div class="mx-auto flex max-w-[1500px] flex-col lg:flex-row">
      <!-- Navigation rail -->
      <header
        class="shrink-0 border-b border-rule bg-surface lg:h-screen lg:w-56 lg:border-b-0 lg:border-r lg:sticky lg:top-0"
      >
        <div class="px-4 py-4">
          <h1 class="text-[15px] font-bold leading-tight tracking-[-0.02em] text-ink">
            MLBB Strategy Lab
          </h1>
          <p class="mt-0.5 text-[11.5px] text-muted">{{ allBets.length }} tracked matches</p>
        </div>

        <nav class="px-2 pb-3 lg:pb-4" aria-label="Sections">
          <ul class="flex flex-wrap gap-1 lg:flex-col">
            <li v-for="item in NAV" :key="item.name">
              <RouterLink v-slot="{ href, navigate, isExactActive }" :to="{ name: item.name }" custom>
                <a
                  :href="href"
                  class="block w-full rounded px-2.5 py-1.5 text-left text-[13px] transition-colors"
                  :class="
                    isExactActive
                      ? 'bg-accent/12 font-semibold text-accent'
                      : 'text-ink-2 hover:bg-sunken'
                  "
                  :aria-current="isExactActive ? 'page' : undefined"
                  @click="navigate"
                >
                  {{ item.label }}
                </a>
              </RouterLink>
            </li>
          </ul>
        </nav>
      </header>

      <!--
        The content column owns its own width: wide tables and plots scroll
        inside their `.scroll-x` wrappers and can never widen the document.
      -->
      <div class="min-w-0 flex-1 overflow-x-clip">
        <!-- Global controls: these scope every figure on every page. -->
        <div
          class="sticky top-0 z-10 flex flex-wrap items-end gap-4 border-b border-rule bg-plane/95 px-4 py-3 backdrop-blur lg:px-6"
        >
          <label class="flex flex-col gap-1">
            <span class="text-[11.5px] text-muted">Weekend</span>
            <select
              v-model="week"
              class="rounded border border-rule bg-surface px-2 py-1.5 text-[12.5px] text-ink"
            >
              <option :value="ALL">All weeks</option>
              <option v-for="label in weeks" :key="label" :value="label">
                {{ shortWeek(label) }}
              </option>
            </select>
          </label>

          <label
            v-if="estimatedCount > 0"
            class="flex items-center gap-2 pb-1.5 text-[12.5px] text-ink-2"
          >
            <input v-model="includeEstimatedPrices" type="checkbox" class="accent-accent" />
            Include estimated prices
            <span class="text-muted">({{ estimatedCount }} rows with approximate 2-0 odds)</span>
          </label>

          <p class="tnum ml-auto pb-1.5 text-[12px] text-muted">
            {{ scoped.length }} picks in scope
          </p>
        </div>

        <main class="px-4 py-4 lg:px-6 lg:py-5">
          <RouterView />
        </main>

        <footer class="border-t border-rule px-4 py-4 text-[12px] leading-relaxed text-muted lg:px-6">
          Flat one-unit stakes throughout. Every tracked pick counts, whether or not it was
          backed, so these returns measure the method rather than an account balance.
        </footer>
      </div>
    </div>
  </div>
</template>
