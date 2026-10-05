<script setup lang="ts">
import { computed, ref } from 'vue'
import Papa from 'papaparse'
import { csvText } from '../lib/dataset'

/**
 * The CSV exactly as written: every column, every row, file order, no
 * interpretation. Only presentation is added — a sticky header, pinned id and
 * day columns, a tint per match day, number alignment, clickable links — so
 * the file is readable. The "day" column is derived from `date` and is not
 * part of the file.
 */
const parsed = computed(() => {
  const result = Papa.parse<string[]>(csvText, { skipEmptyLines: true })
  const [header = [], ...rows] = result.data
  return { header, rows }
})

const dateIndex = computed(() => parsed.value.header.indexOf('date'))
const leagueIndex = computed(() => parsed.value.header.indexOf('league'))
const weekIndex = computed(() => parsed.value.header.indexOf('calendar_week'))

/** Where each league plays, shown beside its name in the block headings. */
const REGION: Record<string, string> = {
  'MPL ID': 'Indonesia',
  'MPL MY': 'Malaysia',
  'MPL PH': 'Philippines',
  'MPL KH': 'Cambodia',
  'MSL Myanmar': 'Myanmar',
  'Asian Games': 'National teams',
}

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
const WEEKDAYS: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const LABEL: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

/** Weekday of an ISO date, read as a calendar date (no timezone shift). */
function weekdayOf(iso: string | undefined): Weekday | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!match) return null
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay()
  return WEEKDAYS[day] ?? null
}

const search = ref('')

/**
 * Newest first by default: latest weekend on top, each league kept together,
 * latest date first inside it. "File order" shows the CSV exactly as stored.
 */
const order = ref<'newest' | 'file'>('newest')

const rows = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const all = parsed.value.rows.map((cells, index) => {
    const date = cells[dateIndex.value]
    return { cells, date: date ?? '', day: weekdayOf(date), index }
  })
  if (order.value === 'newest') {
    // A weekend sorts by its first date, so all of its leagues stay together.
    const weekStart = new Map<string, string>()
    for (const row of all) {
      const week = row.cells[weekIndex.value] ?? ''
      const first = weekStart.get(week)
      if (first === undefined || row.date < first) weekStart.set(week, row.date)
    }
    all.sort((a, b) => {
      const wa = weekStart.get(a.cells[weekIndex.value] ?? '') ?? ''
      const wb = weekStart.get(b.cells[weekIndex.value] ?? '') ?? ''
      if (wa !== wb) return wb.localeCompare(wa)
      const la = a.cells[leagueIndex.value] ?? ''
      const lb = b.cells[leagueIndex.value] ?? ''
      if (la !== lb) return la.localeCompare(lb)
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return b.index - a.index
    })
  }
  if (needle === '') return all
  return all.filter((row) =>
    `${row.cells.join(' ')} ${row.day ? LABEL[row.day] : ''}`.toLowerCase().includes(needle),
  )
})

type RawRow = (typeof rows.value)[number]
type Line =
  | { kind: 'group'; key: string; league: string; region: string; week: string; count: number }
  | { kind: 'row'; key: string; row: RawRow; dateBreak: boolean }

/**
 * Rows with a heading line wherever the league or weekend changes, so each
 * region's block is separated by structure rather than another colour.
 */
const lines = computed<Line[]>(() => {
  const out: Line[] = []
  let heading: Extract<Line, { kind: 'group' }> | null = null
  let previousDate = ''
  rows.value.forEach((row, index) => {
    const league = row.cells[leagueIndex.value] ?? ''
    const week = row.cells[weekIndex.value] ?? ''
    if (heading === null || heading.league !== league || heading.week !== week) {
      heading = {
        kind: 'group',
        key: `g-${index}`,
        league,
        region: REGION[league] ?? '',
        week,
        count: 0,
      }
      out.push(heading)
      previousDate = ''
    }
    heading.count += 1
    out.push({
      kind: 'row',
      key: `r-${index}`,
      row,
      dateBreak: previousDate !== '' && previousDate !== row.date,
    })
    previousDate = row.date
  })
  return out
})

/** Match days get their own tint; Mon–Thu stay plain so the weekend stands out. */
function dayClass(day: Weekday | null): string {
  if (day === 'fri' || day === 'sat' || day === 'sun') return `day-${day}`
  return 'day-plain'
}

const NUMBER = /^-?\d+(\.\d+)?$/
const isNumber = (value: string) => NUMBER.test(value)
const isUrl = (value: string) => /^https?:\/\//.test(value)

/**
 * Free-text columns are cut off at a fixed width so every row stays one line
 * tall; hovering a cell shows its full text.
 */
const WIDE = new Set(['odds_note', 'notes', 'result_source_url'])

const LEGEND = [
  { key: 'day-fri', label: 'Friday' },
  { key: 'day-sat', label: 'Saturday' },
  { key: 'day-sun', label: 'Sunday' },
  { key: 'day-plain', label: 'Mon–Thu' },
] as const
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-rule px-4 py-3">
      <input
        v-model="search"
        type="search"
        placeholder="Find in rows"
        class="w-56 rounded border border-rule bg-surface px-2 py-1 text-[12.5px] text-ink placeholder:text-muted"
      />
      <span class="tnum text-[12px] text-muted">
        {{ rows.length }} of {{ parsed.rows.length }} rows · {{ parsed.header.length }} columns
      </span>
      <label class="flex items-center gap-1.5 text-[12px] text-muted">
        Order
        <select
          v-model="order"
          class="rounded border border-rule bg-surface px-1.5 py-1 text-[12.5px] text-ink"
        >
          <option value="newest">Newest first</option>
          <option value="file">File order</option>
        </select>
      </label>
      <ul class="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto" aria-label="Row colours">
        <li v-for="item in LEGEND" :key="item.key" class="flex items-center gap-1.5 text-[12px] text-ink-2">
          <span class="legend-swatch h-3 w-3 rounded-sm border border-rule-strong" :class="item.key" />
          {{ item.label }}
        </li>
      </ul>
    </div>

    <!-- Scrolls both ways inside the card so the header and id/day columns can stick. -->
    <div class="max-h-[75vh] overflow-auto">
      <table class="border-separate border-spacing-0 text-[12.5px]">
        <thead>
          <tr>
            <th
              class="sticky left-0 top-0 z-20 w-14 min-w-14 whitespace-nowrap border-b border-r border-rule-strong bg-sunken px-3 py-2 text-left font-mono text-[11.5px] font-medium text-ink-2"
            >
              {{ parsed.header[0] }}
            </th>
            <th
              class="sticky left-14 top-0 z-20 w-14 min-w-14 whitespace-nowrap border-b border-r border-rule-strong bg-sunken px-3 py-2 text-left text-[11.5px] font-medium italic text-muted"
              title="Worked out from the date column; not part of the CSV"
            >
              day
            </th>
            <th
              v-for="column in parsed.header.slice(1)"
              :key="column"
              class="sticky top-0 z-10 whitespace-nowrap border-b border-r border-rule-strong bg-sunken px-3 py-2 text-left font-mono text-[11.5px] font-medium text-ink-2"
            >
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="line in lines" :key="line.key">
          <tr v-if="line.kind === 'group'" class="group-heading" data-group>
            <td :colspan="parsed.header.length + 1" class="px-0 py-0">
              <!-- Pinned left so the heading stays in view while scrolling sideways. -->
              <div class="sticky left-0 inline-flex items-baseline gap-2 px-3 py-2">
                <span class="text-[13px] font-bold text-ink">{{ line.league }}</span>
                <span v-if="line.region" class="text-[12.5px] font-medium text-ink-2">{{ line.region }}</span>
                <span class="text-[12.5px] text-muted">— {{ line.week }}</span>
                <span class="tnum text-[12px] text-muted">
                  · {{ line.count }} match{{ line.count === 1 ? '' : 'es' }}
                </span>
              </div>
            </td>
          </tr>
          <tr
            v-else
            :class="[dayClass(line.row.day), line.dateBreak ? 'date-break' : '']"
          >
            <td
              class="sticky left-0 z-[5] w-14 min-w-14 whitespace-nowrap border-b border-r border-rule px-3 py-1.5 text-right font-semibold text-ink tnum"
            >
              {{ line.row.cells[0] }}
            </td>
            <td
              class="day-cell sticky left-14 z-[5] w-14 min-w-14 whitespace-nowrap border-b border-r border-rule px-3 py-1.5 text-[12px]"
              data-derived
            >
              {{ line.row.day ? LABEL[line.row.day] : '' }}
            </td>
            <td
              v-for="(value, offset) in line.row.cells.slice(1)"
              :key="offset"
              class="whitespace-nowrap border-b border-r border-rule px-3 py-1.5 text-ink-2"
              :class="[
                isNumber(value) ? 'tnum text-right' : '',
                WIDE.has(parsed.header[offset + 1] ?? '') ? 'max-w-[18rem] truncate' : '',
              ]"
              :title="WIDE.has(parsed.header[offset + 1] ?? '') && value !== '' ? value : undefined"
            >
              <a
                v-if="isUrl(value)"
                :href="value"
                target="_blank"
                rel="noopener noreferrer"
                class="text-accent underline underline-offset-2"
              >
                {{ value }}
              </a>
              <template v-else>{{ value }}</template>
            </td>
          </tr>
          </template>
          <tr v-if="rows.length === 0">
            <td :colspan="parsed.header.length + 1" class="px-4 py-8 text-center text-muted">
              No row contains "{{ search }}".
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/*
 * Tints are mixed into the surface rather than layered with transparency, so
 * the pinned id/day cells stay opaque while the rest scrolls underneath them.
 * They follow the theme because the series and surface tokens do.
 */
tr.day-fri td {
  background-color: color-mix(in srgb, var(--color-series-1) 13%, var(--color-surface));
}
tr.day-sat td {
  background-color: color-mix(in srgb, var(--color-series-3) 15%, var(--color-surface));
}
tr.day-sun td {
  background-color: color-mix(in srgb, var(--color-series-2) 13%, var(--color-surface));
}
tr.day-plain td {
  background-color: var(--color-surface);
}

/* Legend squares match the solid edge bar, which is the easiest mark to spot. */
.legend-swatch.day-fri {
  background-color: var(--color-series-1);
}
.legend-swatch.day-sat {
  background-color: var(--color-series-3);
}
.legend-swatch.day-sun {
  background-color: var(--color-series-2);
}
.legend-swatch.day-plain {
  background-color: var(--color-surface);
}

tr.day-fri:hover td {
  background-color: color-mix(in srgb, var(--color-series-1) 24%, var(--color-surface));
}
tr.day-sat:hover td {
  background-color: color-mix(in srgb, var(--color-series-3) 26%, var(--color-surface));
}
tr.day-sun:hover td {
  background-color: color-mix(in srgb, var(--color-series-2) 24%, var(--color-surface));
}
tr.day-plain:hover td {
  background-color: var(--color-sunken);
}

/*
 * A full-strength bar on the row's left edge carries the day colour; the day
 * label itself stays in readable ink rather than coloured text.
 */
tr.day-fri td:first-child {
  box-shadow: inset 4px 0 0 var(--color-series-1);
}
tr.day-sat td:first-child {
  box-shadow: inset 4px 0 0 var(--color-series-3);
}
tr.day-sun td:first-child {
  box-shadow: inset 4px 0 0 var(--color-series-2);
}
tr.day-fri .day-cell,
tr.day-sat .day-cell,
tr.day-sun .day-cell {
  color: var(--color-ink);
  font-weight: 600;
}
tr.day-plain .day-cell {
  color: var(--color-muted);
}

/* A heavier rule where the date changes, so each match day reads as a block. */
tr.date-break td {
  border-top: 2px solid var(--color-rule-strong);
}

/*
 * League/weekend headings: a sunken band with a heavy ink rule above, clearly
 * stronger than the date rule, so region blocks separate at a glance. The
 * first heading sits right under the column header and needs no rule.
 */
tr.group-heading td {
  background-color: var(--color-sunken);
  border-top: 3px solid var(--color-ink-2);
  border-bottom: 1px solid var(--color-rule-strong);
}
tbody tr.group-heading:first-child td {
  border-top: none;
}
</style>
