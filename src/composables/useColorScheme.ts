import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Charts pick their own steps per theme rather than flipping colours, so they
 * need to know which surface they are being drawn on.
 */
export function useColorScheme() {
  const dark = ref(false)
  let query: MediaQueryList | null = null

  const sync = (event: MediaQueryListEvent | MediaQueryList) => {
    dark.value = event.matches
  }

  onMounted(() => {
    query = window.matchMedia('(prefers-color-scheme: dark)')
    sync(query)
    query.addEventListener('change', sync)
  })

  onBeforeUnmount(() => {
    query?.removeEventListener('change', sync)
  })

  return { dark }
}
