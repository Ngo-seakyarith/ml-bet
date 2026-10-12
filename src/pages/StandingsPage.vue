<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataset } from '../composables/useDataset'
import { LEAGUES, PLAYOFF_FORMAT, clinchStatus, lastPlayedWeek, playbookEvidence, seasonsFor, standings, weeksIn, type StandingRow, type TeamGame } from '../lib/standings'
import { measureMargins, otherSideOdds } from '../lib/stats'
import type { Bet } from '../lib/types'
import SectionCard from '../components/ui/SectionCard.vue'
import TeamLogo from '../components/ui/TeamLogo.vue'
import PlayoffBracket from '../components/PlayoffBracket.vue'
import MatchPanel from '../components/MatchPanel.vue'
import SeasonUpsets from '../components/SeasonUpsets.vue'
import { odds, percent, shortDate } from '../lib/format'

const { allBets } = useDataset()

/*
 * The three filters live in the URL (?league=id&season=17&week=5), so a
 * refresh or a shared link shows the same table. Defaults are left out:
 * PH, this season, all weeks. Changing the league clears season and week;
 * changing the season clears the week.
 */
type League = (typeof LEAGUES)[number]
const route = useRoute()
const router = useRouter()
const leagueParam = (l: League) => l.replace('MPL ', '').toLowerCase()
const queryValue = (key: string) => {
  const v = route.query[key]
  return typeof v === 'string' && v !== '' ? v : null
}
function setQuery(patch: Record<string, string | null>) {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...route.query, ...patch })) if (typeof v === 'string') query[k] = v
  void router.replace({ query })
}

const league = computed<League>({
  get: () => LEAGUES.find((l) => leagueParam(l) === queryValue('league')) ?? 'MPL PH',
  set: (l) => setQuery({ league: l === 'MPL PH' ? null : leagueParam(l), season: null, week: null }),
})
const allSeasons = computed(() => seasonsFor())
/** This league's seasons, newest first. */
const seasons = computed(() => allSeasons.value.filter((s) => s.league === league.value))
const seasonNumber = (id: string) => id.split('-').pop() ?? ''
/** '' is this season (the default); otherwise a past season's id. */
const seasonId = computed<string>({
  get: () => {
    const wanted = queryValue('season')
    const found = seasons.value.find((s) => seasonNumber(s.id) === wanted)
    return found && !found.current ? found.id : ''
  },
  set: (id) => setQuery({ season: id === '' ? null : seasonNumber(id), week: null }),
})
const season = computed(() => seasons.value.find((s) => s.id === seasonId.value) ?? seasons.value[0]!)
const previous = computed(() => {
  const i = seasons.value.findIndex((s) => s.id === season.value.id)
  return seasons.value[i + 1] ?? null
})

const weeks = computed(() => weeksIn(season.value).filter((w) => w <= lastPlayedWeek(season.value)))
/** Null shows the whole season so far; a number shows the table after that week. */
const throughWeek = computed<number | null>({
  get: () => {
    const w = Number(queryValue('week'))
    return weeks.value.includes(w) ? w : null
  },
  set: (w) => setQuery({ week: w === null ? null : String(w) }),
})
const rows = computed(() => standings(season.value, throughWeek.value, previous.value))
const weekShown = computed(() => throughWeek.value ?? lastPlayedWeek(season.value))

/** Both leagues send the top six to the playoffs. */
const PLAYOFF_SPOTS = 6

/** Final regular-season ranks of the selected season, the seeds for its playoff bracket. */
const finalSeeds = computed<ReadonlyMap<string, number>>(
  () => new Map(standings(season.value, null, previous.value).map((r) => [r.team, r.rank])),
)

/** Leagues where the last-place team is swept often enough to bet 2-0 against (not ID). */
const SWEEP_TARGET_LEAGUES: ReadonlySet<string> = new Set(['MPL PH', 'MPL MY'])

/** This league's bracket cuts, smallest first (e.g. top 2, top 4, top 6). */
const cutoffs = computed(() => PLAYOFF_FORMAT[league.value] ?? [])
const cutLines = computed(() => new Set(cutoffs.value.map((c) => c.spots).filter((n) => n !== PLAYOFF_SPOTS)))

/**
 * Clinched / out for the whole season (not a past week's table), from every
 * possible result of the matches still to play.
 */
const clinch = computed(() => (throughWeek.value === null ? clinchStatus(season.value, cutoffs.value) : null))

type Status = 'upper' | 'playoffs' | 'open' | 'out'

/** One of four states per team; null when a past week's table is shown. */
function status(team: string): Status | null {
  const marks = clinch.value?.get(team)
  if (!marks) return null
  const [upper, playoffs] = marks
  if (upper === 'clinched') return 'upper'
  if (playoffs === 'clinched') return 'playoffs'
  if (playoffs === 'out') return 'out'
  return 'open'
}

/** Row colour per state; "not confirmed" stays plain. */
const STATUS_COLOR: Record<Status, string | null> = {
  upper: 'var(--color-good)',
  playoffs: 'var(--color-lime)',
  open: null,
  out: 'var(--color-critical)',
}

const LEGEND = computed(() => [
  { status: 'upper' as const, label: `Upper bracket (top ${cutoffs.value[0]?.spots})` },
  { status: 'playoffs' as const, label: `Playoffs (top ${cutoffs.value[1]?.spots})` },
  { status: 'open' as const, label: 'Not confirmed' },
  { status: 'out' as const, label: 'Out of playoffs' },
])

/** Tint for the row, plus a bar on the left edge of the sticky team cell. */
function rowStyle(team: string, edge = false): Record<string, string> {
  const s = status(team)
  const color = s ? STATUS_COLOR[s] : null
  if (!color) return edge ? { background: 'var(--color-surface)' } : {}
  const tint = `color-mix(in oklab, ${color} ${s === 'out' ? 7 : 11}%, var(--color-surface))`
  return edge ? { background: tint, boxShadow: `inset 3px 0 0 ${color}` } : { background: tint }
}

/* Results column: one box per match; clicking a box opens that match under the row. */
const openGame = ref<{ team: string; index: number } | null>(null)
watch([league, () => season.value.id, throughWeek], () => (openGame.value = null))

const panel = ref<HTMLElement | null>(null)

async function toggleGame(team: string, index: number) {
  const same = openGame.value?.team === team && openGame.value.index === index
  openGame.value = same ? null : { team, index }
  if (!same) {
    await nextTick()
    panel.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

/** The open result box's team and series. */
const opened = computed(() => {
  if (!openGame.value) return null
  const row = rows.value.find((r) => r.team === openGame.value!.team)
  const game = row?.games[openGame.value.index]
  return row && game ? { team: row.team, game } : null
})

function gameLabel(g: TeamGame): string {
  if (g.mapsFor === null || g.mapsAgainst === null) return `Week ${g.week} · ${shortDate(g.date)} · v ${g.opponent} · not played yet`
  const result = g.mapsFor > g.mapsAgainst ? 'won' : 'lost'
  return `Week ${g.week} · ${shortDate(g.date)} · v ${g.opponent} · ${result} ${g.mapsFor}-${g.mapsAgainst}`
}

function movement(row: StandingRow): { text: string; tone: string } | null {
  if (row.previousRank === null) return null
  const change = row.previousRank - row.rank
  if (change === 0) return { text: '=', tone: 'text-muted' }
  return change > 0 ? { text: `▲${change}`, tone: 'text-good' } : { text: `▼${-change}`, tone: 'text-critical' }
}

function share(part: number, whole: number): string {
  return whole === 0 ? '—' : percent(part / whole, 0)
}

/* ---------------------------------------------------------------------
 * This week's calls: each league's playbook applied to the fixtures still
 * to play, with prices from the betting CSV when you have recorded them.
 * ------------------------------------------------------------------- */
const margins = computed(() => measureMargins(allBets.value))

/** Recomputed from this league's seasons, so the wording follows the data. */
const evidence = computed(() => playbookEvidence(seasons.value))
const sweptShare = computed(() => share(evidence.value.lastPlaceSwept, evidence.value.lastPlaceLosses))
const earlyShare = computed(() => share(evidence.value.earlyFavouriteWins, evidence.value.earlyMatches))

/** The recorded row for a fixture, matched on league, date and the two teams. */
function betFor(date: string, a: string, b: string): Bet | undefined {
  return allBets.value.find(
    (bet) =>
      bet.league === league.value &&
      bet.date === date &&
      ((bet.selectedTeam === a && bet.opponent === b) || (bet.selectedTeam === b && bet.opponent === a)),
  )
}

/** Both teams' Match Winner prices for a fixture, in a/b order. */
function pricesFor(bet: Bet | undefined, a: string): { a: number; b: number } | null {
  if (!bet || bet.winnerOdds === null) return null
  const theirs = bet.opponentOdds ?? otherSideOdds(bet.winnerOdds, margins.value(bet.league).margin)
  if (theirs === null) return null
  return bet.selectedTeam === a ? { a: bet.winnerOdds, b: theirs } : { a: theirs, b: bet.winnerOdds }
}

const calls = computed(() => {
  if (!season.value.current) return []
  const table = standings(season.value, null, previous.value)
  const byTeam = new Map(table.map((r) => [r.team, r]))
  const last = table.at(-1)?.team
  const week = lastPlayedWeek(season.value) + 1
  const winRate = (team: string) => {
    const r = byTeam.get(team)
    return r && r.played > 0 ? r.wins / r.played : 0
  }
  return season.value.results
    .filter((r) => r.mapsA === null)
    .map((r) => {
      const a = r.teamA
      const b = r.teamB
      const price = pricesFor(betFor(r.date, a, b), a)
      const bookFav = price === null ? null : price.a <= price.b ? a : b
      const bookDog = bookFav === null ? null : bookFav === a ? b : a
      const tableFav = (byTeam.get(a)?.rank ?? 99) < (byTeam.get(b)?.rank ?? 99) ? a : b
      let call: string
      let tone: 'strong' | 'normal' | 'skip'
      let shown: string | null = null

      if (week <= 2) {
        call = `Weeks 1–2: small stakes or wait. Favourites by last season's table have won only ${earlyShare.value} of Week 1–2 matches.`
        tone = 'skip'
      } else if (league.value === 'MPL MY') {
        // MPL MY: only two seasons of results and few priced matches, so the one
        // tested rule is the bottom team getting swept.
        if (a === last || b === last) {
          const bottom = table.at(-1)!
          call = `${tableFav} 2-0, 1 unit, only at a 2-0 price of 1.45 or better. ${bottom.team} are last. The last-place team has been swept in ${sweptShare.value} of its losses over both MY seasons (${evidence.value.lastPlaceSwept} of ${evidence.value.lastPlaceLosses}), and ${share(bottom.l02, bottom.losses)} this season (${bottom.l02} of ${bottom.losses}).`
          tone = 'strong'
        } else {
          call = 'No tested MPL MY edge for this match yet. Watch, or stake small.'
          tone = 'skip'
        }
      } else if (league.value === 'MPL ID') {
        // MPL ID: the bookmaker overrates favourites, and big names most of all.
        if (bookFav === null || bookDog === null || price === null) {
          call = 'No price in the betting CSV yet. When it is in: back the underdog to win, never 2-0.'
          tone = 'skip'
        } else {
          shown = `underdog ${odds(bookDog === a ? price.a : price.b)}`
          if (winRate(bookDog) > winRate(bookFav)) {
            call = `${bookDog} to win, 1 unit. They have the better record, so the bookmaker is pricing ${bookFav}'s name, not their form.`
            tone = 'strong'
          } else {
            call = `${bookDog} to win, 1 unit: MPL ID underdogs pay. Never 2-0.`
            tone = 'normal'
          }
        }
      } else {
        // MPL PH: the bookmaker underrates favourites.
        if (bookFav !== null && price !== null) shown = `favourite ${odds(bookFav === a ? price.a : price.b)}`
        if (bookFav !== null && bookFav !== tableFav) {
          call = `No edge: the table favours ${tableFav}, the bookmaker favours ${bookFav}. Skip or stake small.`
          tone = 'skip'
        } else if (a === last || b === last) {
          const bottom = table.at(-1)!
          call = `${tableFav} 2-0, 1 unit. ${bottom.team} are last. The last-place team has been swept in ${sweptShare.value} of its losses over all seasons (${evidence.value.lastPlaceSwept} of ${evidence.value.lastPlaceLosses}), and ${share(bottom.l02, bottom.losses)} this season (${bottom.l02} of ${bottom.losses}).`
          tone = 'strong'
        } else {
          call = `${tableFav} favourite, 1 unit: 2-0 for the bigger payout, or to win for steadier returns.`
          tone = 'normal'
        }
      }
      return {
        id: `${r.date}-${a}-${b}`,
        date: r.date,
        a,
        b,
        rankA: byTeam.get(a)?.rank ?? null,
        rankB: byTeam.get(b)?.rank ?? null,
        shown,
        call,
        tone,
      }
    })
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard
      title="Regular season standings"
      :note="`Ranked by series wins, then map difference. ${cutoffs.map((c) => c.label).join('; ')}.`"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <select
            v-model="league"
            aria-label="League"
            class="min-h-10 rounded border border-rule bg-surface px-2 text-[14px] text-ink lg:min-h-0 lg:py-1 lg:text-[12.5px]"
          >
            <option v-for="l in LEAGUES" :key="l" :value="l">{{ l }}</option>
          </select>
          <select
            v-model="seasonId"
            aria-label="Season"
            class="min-h-10 rounded border border-rule bg-surface px-2 text-[14px] text-ink lg:min-h-0 lg:py-1 lg:text-[12.5px]"
          >
            <option v-for="s in seasons" :key="s.id" :value="s.id === seasons[0]!.id ? '' : s.id">{{ s.label }}</option>
          </select>
          <select
            v-model="throughWeek"
            aria-label="Table after week"
            class="min-h-10 rounded border border-rule bg-surface px-2 text-[14px] text-ink lg:min-h-0 lg:py-1 lg:text-[12.5px]"
          >
            <option :value="null">All weeks</option>
            <option v-for="w in weeks" :key="w" :value="w">After week {{ w }}</option>
          </select>
        </div>
      </template>

      <div v-if="clinch" class="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-rule px-4 py-2.5 text-[12px] text-ink-2">
        <span v-for="item in LEGEND" :key="item.status" class="inline-flex items-center gap-1.5">
          <span
            class="inline-block h-3 w-3 rounded-[3px] border border-rule"
            :style="STATUS_COLOR[item.status] ? { background: STATUS_COLOR[item.status]! } : {}"
          />
          {{ item.label }}
        </span>
        <span class="text-muted">Worked out from every possible result of the matches left; teams level on wins go to the tiebreak, so stay not confirmed.</span>
      </div>
      <div class="scroll-x">
        <table class="w-full min-w-[820px] border-collapse whitespace-nowrap text-[13px]">
          <thead>
            <tr class="border-b border-rule-strong text-left">
              <th class="sticky left-0 z-10 bg-surface px-4 py-2 font-medium text-ink-2">Team</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">W-L</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Maps</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Diff</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2" title="Wins by 2-0 / by 2-1">Won 2-0 / 2-1</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2" title="Losses by 1-2 / by 0-2">Lost 1-2 / 0-2</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2" title="Share of wins that were 2-0">Sweeps</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2" title="Share of losses where they took a map">Map in loss</th>
              <th class="px-3 py-2 font-medium text-ink-2">Results</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Last season</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in rows" :key="row.team">
            <tr
              class="border-b border-rule last:border-b-0"
              :style="rowStyle(row.team)"
              :class="row.rank === PLAYOFF_SPOTS ? 'border-b-2 border-b-rule-strong' : cutLines.has(row.rank) ? 'border-b-rule-strong border-dashed' : ''"
            >
              <th scope="row" class="sticky left-0 z-10 px-4 py-2 text-left font-medium text-ink" :style="rowStyle(row.team, true)">
                <span class="inline-flex items-center gap-2">
                  <span class="tnum w-4 text-right text-muted">{{ row.rank }}</span>
                  <TeamLogo :team="row.team" :size="20" />
                  {{ row.team }}
                  <span
                    v-if="SWEEP_TARGET_LEAGUES.has(league) && season.current && row.rank === rows.length && weekShown >= 3"
                    class="rounded bg-serious/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-serious"
                    title="Bet 2-0 against the last-place team"
                  >
                    2-0 target
                  </span>
                </span>
              </th>
              <td class="tnum px-3 py-2 text-right font-semibold text-ink">{{ row.wins }}-{{ row.losses }}</td>
              <td class="tnum px-3 py-2 text-right text-ink-2">{{ row.mapsWon }}-{{ row.mapsLost }}</td>
              <td
                class="tnum px-3 py-2 text-right"
                :class="row.mapsWon - row.mapsLost > 0 ? 'text-good' : row.mapsWon - row.mapsLost < 0 ? 'text-critical' : 'text-muted'"
              >
                {{ row.mapsWon - row.mapsLost > 0 ? '+' : '' }}{{ row.mapsWon - row.mapsLost }}
              </td>
              <td class="tnum px-3 py-2 text-right text-ink-2">{{ row.w20 }} / {{ row.w21 }}</td>
              <td class="tnum px-3 py-2 text-right text-ink-2">{{ row.l12 }} / {{ row.l02 }}</td>
              <td class="tnum px-3 py-2 text-right">{{ share(row.w20, row.wins) }}</td>
              <td class="tnum px-3 py-2 text-right">{{ share(row.l12, row.losses) }}</td>
              <td class="px-3 py-2">
                <span class="inline-flex gap-0.5">
                  <button
                    v-for="(g, i) in row.games"
                    :key="i"
                    type="button"
                    class="inline-flex h-5 w-[18px] items-center justify-center rounded-[3px] text-[10px] font-bold"
                    :class="[
                      g.mapsFor === null
                        ? 'border border-dashed border-rule-strong text-muted'
                        : (g.mapsFor ?? 0) > (g.mapsAgainst ?? 0)
                          ? 'bg-good text-white'
                          : 'bg-critical text-white',
                      openGame?.team === row.team && openGame.index === i ? 'ring-2 ring-ink ring-offset-1' : '',
                    ]"
                    :title="gameLabel(g)"
                    :aria-label="gameLabel(g)"
                    :aria-pressed="openGame?.team === row.team && openGame.index === i"
                    @click="toggleGame(row.team, i)"
                  >
                    {{ g.mapsFor === null ? '' : (g.mapsFor ?? 0) > (g.mapsAgainst ?? 0) ? 'W' : 'L' }}
                  </button>
                </span>
              </td>
              <td class="tnum px-3 py-2 text-right text-ink-2">
                <template v-if="row.previousRank !== null">
                  {{ row.previousRank }}
                  <span class="ml-1 text-[11.5px]" :class="movement(row)?.tone">{{ movement(row)?.text }}</span>
                </template>
                <template v-else>—</template>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
      <!-- The series behind the clicked result box: every game, stats and lineups. -->
      <div v-if="opened" ref="panel" class="scroll-mt-20 border-t border-rule bg-sunken/40 px-4 py-3">
        <MatchPanel :team="opened.team" :game="opened.game" @close="openGame = null" />
      </div>
      <p class="border-t border-rule px-4 py-2.5 text-[12px] leading-relaxed text-muted">
        "Sweeps" is the share of a team's wins that were 2-0, and "Map in loss" the share of its losses
        where it still took a map. These habits barely carry over from one season to the next, so use
        them as context, not as a reason to bet 2-1. "Last season" is the final rank a season earlier;
        that table is what sets Week 1–2 prices, and favourites built on it have won only {{ earlyShare }} of Week 1–2 matches ({{ evidence.earlyFavouriteWins }} of {{ evidence.earlyMatches }}).
      </p>
    </SectionCard>

    <SeasonUpsets v-if="season.current" :league="league" :through-week="throughWeek" />

    <PlayoffBracket :league="league" :season="Number(seasonNumber(season.id))" :seeds="finalSeeds" />

    <SectionCard
      v-if="calls.length > 0"
      title="Matches still to play"
      :note="`The ${league} playbook applied to the current table and the prices in the betting CSV.`"
    >
      <ul class="flex flex-col">
        <li
          v-for="item in calls"
          :key="item.id"
          class="flex flex-col gap-1.5 border-b border-rule px-4 py-3 last:border-b-0"
        >
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
            <span class="tnum text-[12px] text-muted">{{ shortDate(item.date) }}</span>
            <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
              <TeamLogo :team="item.a" :size="18" />
              <span class="font-medium text-ink">{{ item.a }}</span>
              <span class="tnum text-[12px] text-muted">({{ item.rankA ?? '—' }})</span>
            </span>
            <span class="text-muted">v</span>
            <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
              <TeamLogo :team="item.b" :size="18" />
              <span class="font-medium text-ink">{{ item.b }}</span>
              <span class="tnum text-[12px] text-muted">({{ item.rankB ?? '—' }})</span>
            </span>
            <span v-if="item.shown" class="tnum ml-auto text-[12px] text-muted">{{ item.shown }}</span>
          </div>
          <p
            class="text-[13px] leading-snug"
            :class="item.tone === 'strong' ? 'font-semibold text-good' : item.tone === 'skip' ? 'text-muted' : 'text-ink'"
          >
            {{ item.call }}
          </p>
        </li>
      </ul>
    </SectionCard>
  </div>
</template>
