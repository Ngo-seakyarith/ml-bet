import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import DashboardPage from './pages/DashboardPage.vue'
import MatchesPage from './pages/MatchesPage.vue'
import OddsGroupsPage from './pages/OddsGroupsPage.vue'
import WeeksPage from './pages/WeeksPage.vue'
import LeaguesPage from './pages/LeaguesPage.vue'
import UnderdogsPage from './pages/UnderdogsPage.vue'
import BankrollPage from './pages/BankrollPage.vue'
import DataPage from './pages/DataPage.vue'

/** One entry per sidebar tab, in sidebar order. */
export const PAGES = [
  { path: '/', name: 'dashboard', label: 'Dashboard', component: DashboardPage },
  { path: '/matches', name: 'matches', label: 'Matches', component: MatchesPage },
  { path: '/odds-groups', name: 'groups', label: 'Odds groups', component: OddsGroupsPage },
  { path: '/weeks', name: 'weeks', label: 'Weeks', component: WeeksPage },
  { path: '/leagues', name: 'leagues', label: 'Leagues', component: LeaguesPage },
  { path: '/underdogs', name: 'underdogs', label: 'Underdogs', component: UnderdogsPage },
  { path: '/bankroll', name: 'bankroll', label: 'Bankroll', component: BankrollPage },
  { path: '/data', name: 'data', label: 'Data', component: DataPage },
] as const

const routes: RouteRecordRaw[] = [
  ...PAGES.map(({ path, name, label, component }) => ({
    path,
    name,
    component,
    meta: { label },
  })),
  // Unknown paths fall back to the dashboard rather than a blank page.
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  // A new tab starts at the top instead of keeping the previous tab's scroll.
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const label = to.meta.label
  document.title =
    typeof label === 'string' && to.name !== 'dashboard'
      ? `${label} · MLBB Strategy Lab`
      : 'MLBB Strategy Lab'
})
