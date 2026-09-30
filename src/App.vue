<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { ALL, useDataset } from './composables/useDataset'
import { PAGES as NAV } from './router'
import { shortWeek } from './lib/format'

const { includeEstimatedPrices, week, weeks, scoped, allBets } = useDataset()

/** Rows whose 2-0 price was interpolated rather than observed. */
const estimatedCount = computed(
  () => allBets.value.filter((bet) => bet.oddsQuality === 'estimated').length,
)

/**
 * On phones the tabs are one swipeable row. Keep the current tab in view when
 * the route changes, so a tab near the end is never hidden off-screen.
 */
const route = useRoute()
const tabStrip = ref<HTMLElement | null>(null)
watch(
  () => route.name,
  async () => {
    await nextTick()
    const active = tabStrip.value?.querySelector<HTMLElement>('[aria-current="page"]')
    active?.scrollIntoView({ block: 'nearest', inline: 'center' })
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-screen bg-plane">
    <div class="mx-auto max-w-[1500px] lg:flex">
      <!-- Desktop: a sidebar that stays in place. -->
      <aside
        class="hidden shrink-0 border-r border-rule bg-surface lg:sticky lg:top-0 lg:block lg:h-screen lg:w-56"
      >
        <div class="px-4 py-4">
          <h1 class="text-[15px] font-bold leading-tight tracking-[-0.02em] text-ink">
            MLBB Strategy Lab
          </h1>
          <p class="mt-0.5 text-[11.5px] text-muted">{{ allBets.length }} tracked matches</p>
        </div>
        <nav class="px-2 pb-4" aria-label="Sections">
          <ul class="flex flex-col gap-1">
            <li v-for="item in NAV" :key="item.name">
              <RouterLink v-slot="{ href, navigate, isExactActive }" :to="{ name: item.name }" custom>
                <a
                  :href="href"
                  class="block rounded px-2.5 py-1.5 text-[13px] transition-colors"
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
      </aside>

      <!--
        The content column owns its own width: wide tables and plots scroll
        inside their `.scroll-x` wrappers and can never widen the document.
      -->
      <div class="min-w-0 flex-1 overflow-x-clip">
        <!-- Phone: one-line title that scrolls away. -->
        <div class="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3 lg:hidden">
          <h1 class="text-[15px] font-bold tracking-[-0.02em] text-ink">MLBB Strategy Lab</h1>
          <span class="tnum text-[12px] text-muted">{{ allBets.length }} matches</span>
        </div>

        <!-- Phone: tabs as one swipeable row, pinned to the top while scrolling. -->
        <nav
          ref="tabStrip"
          class="tab-strip sticky top-0 z-30 flex gap-1 overflow-x-auto border-b border-rule bg-plane/95 px-3 py-1.5 backdrop-blur lg:hidden"
          aria-label="Sections"
        >
          <RouterLink
            v-for="item in NAV"
            :key="item.name"
            v-slot="{ href, navigate, isExactActive }"
            :to="{ name: item.name }"
            custom
          >
            <a
              :href="href"
              class="flex min-h-10 shrink-0 items-center rounded-full px-3.5 text-[13.5px] transition-colors"
              :class="
                isExactActive
                  ? 'bg-accent font-semibold text-white'
                  : 'text-ink-2 active:bg-sunken'
              "
              :aria-current="isExactActive ? 'page' : undefined"
              @click="navigate"
            >
              {{ item.label }}
            </a>
          </RouterLink>
        </nav>

        <!-- Global controls: these scope every figure on every page. -->
        <div
          class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-4 py-2.5 lg:sticky lg:top-0 lg:z-10 lg:bg-plane/95 lg:px-6 lg:py-3 lg:backdrop-blur"
        >
          <label class="flex items-center gap-2">
            <!-- The dropdown already reads "All weeks", so phones drop the visible label. -->
            <span class="text-[12.5px] text-muted max-sm:sr-only">Weekend</span>
            <select
              v-model="week"
              class="min-h-10 rounded border border-rule bg-surface px-2 text-[14px] text-ink lg:min-h-0 lg:py-1.5 lg:text-[12.5px]"
            >
              <option :value="ALL">All weeks</option>
              <option v-for="label in weeks" :key="label" :value="label">
                {{ shortWeek(label) }}
              </option>
            </select>
          </label>

          <label
            v-if="estimatedCount > 0"
            class="flex min-h-10 items-center gap-2 text-[13px] text-ink-2 lg:min-h-0 lg:text-[12.5px]"
            :title="`${estimatedCount} rows have approximate 2-0 odds`"
          >
            <input v-model="includeEstimatedPrices" type="checkbox" class="h-4 w-4 accent-accent" />
            Estimated prices
            <span class="hidden text-muted sm:inline">({{ estimatedCount }} rows)</span>
          </label>

          <p class="tnum ml-auto text-[12px] text-muted">{{ scoped.length }} picks</p>
        </div>

        <main class="px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
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

<style scoped>
/* The tab row scrolls sideways by swipe; the scrollbar itself is just noise. */
.tab-strip {
  scrollbar-width: none;
}
.tab-strip::-webkit-scrollbar {
  display: none;
}
</style>
