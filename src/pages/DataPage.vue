<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { discrepancies, marketMoves, oddsQualityBreakdown } from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import StatTile from '../components/ui/StatTile.vue'
import { odds, percent, shortDate, signedPercent } from '../lib/format'

const { allBets, issues } = useDataset()

const errors = computed(() => issues.value.filter((issue) => issue.severity === 'error'))
const warnings = computed(() => issues.value.filter((issue) => issue.severity === 'warning'))
const mismatches = computed(() => discrepancies(allBets.value))
const quality = computed(() => oddsQualityBreakdown(allBets.value))
const moves = computed(() => marketMoves(allBets.value))

const statusCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const bet of allBets.value) counts.set(bet.betStatus, (counts.get(bet.betStatus) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="grid rounded-md border border-rule bg-surface sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Rows parsed" :value="String(allBets.length)" support="From the bundled CSV" />
      <StatTile
        label="Errors"
        :value="String(errors.length)"
        support="Rows that could not be read"
        :tone="errors.length > 0 ? 'bad' : 'flat'"
      />
      <StatTile
        label="Warnings"
        :value="String(warnings.length)"
        support="Read, but worth a look"
        :tone="warnings.length > 0 ? 'bad' : 'flat'"
      />
      <StatTile
        label="Profit mismatches"
        :value="String(mismatches.length)"
        support="CSV against recomputation"
        :tone="mismatches.length > 0 ? 'bad' : 'flat'"
      />
    </section>

    <SectionCard
      title="Updating the data"
      note="The CSV is the source of truth. Nothing is uploaded and nothing is stored in the browser."
    >
      <div class="flex flex-col gap-3 px-4 py-4 text-[13px] leading-relaxed text-ink-2">
        <p class="max-w-[72ch]">
          Edit
          <code class="rounded bg-sunken px-1 py-0.5 text-[12px] text-ink">
            src/data/mlbb_betting_dataset.csv
          </code>
          and save. The dev server reloads the file and every figure on every page recalculates
          from it — there is no database and no import step.
        </p>
        <p class="max-w-[72ch] text-muted">
          Add a row per match with its Match Winner price and result, then fill the strategy
          columns once the bet is decided. Leave a price column blank rather than guessing;
          blank means "not applicable" everywhere in this app, and a bet with no usable price is
          left out of ROI rather than counted at evens.
        </p>
      </div>
    </SectionCard>

    <SectionCard
      v-if="issues.length > 0"
      title="Validation"
      note="Warnings do not stop a row from being counted; they flag a disagreement worth resolving."
    >
      <div class="scroll-x">
        <table class="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-rule-strong text-left">
              <th class="px-4 py-2 font-medium text-ink-2">Row</th>
              <th class="px-3 py-2 font-medium text-ink-2">Column</th>
              <th class="px-3 py-2 font-medium text-ink-2">Issue</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(issue, index) in issues" :key="index" class="border-b border-rule last:border-b-0">
              <td class="tnum px-4 py-2 text-ink-2">{{ issue.recordId }}</td>
              <td class="px-3 py-2">
                <code class="text-[12px] text-ink-2">{{ issue.field }}</code>
              </td>
              <td class="px-3 py-2" :class="issue.severity === 'error' ? 'text-critical' : 'text-serious'">
                {{ issue.message }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <SectionCard v-else title="Validation" note="Nothing to fix.">
      <p class="px-4 py-4 text-[13px] text-ink-2">
        All {{ allBets.length }} rows parsed cleanly, and every stored profit column agrees with
        the recomputed value.
      </p>
    </SectionCard>

    <SectionCard
      title="Price quality"
      note="ROI uses actual before snapshot before estimated. Estimated prices are backtest reconstructions, not bets."
    >
      <div class="grid gap-0 sm:grid-cols-4">
        <StatTile label="Actual" :value="String(quality.actual)" support="Price actually taken" />
        <StatTile label="Snapshot" :value="String(quality.snapshot)" support="Planned price observed" />
        <StatTile
          label="Estimated"
          :value="String(quality.estimated)"
          support="Interpolated for backtest"
          :tone="quality.estimated > 0 ? 'bad' : 'flat'"
        />
        <StatTile label="No price" :value="String(quality.none)" support="Excluded from ROI" />
      </div>
    </SectionCard>

    <SectionCard
      v-if="moves.length > 0"
      title="Market movement"
      note="Rows where both a planning price and a taken price were recorded."
    >
      <div class="scroll-x">
        <table class="w-full min-w-[620px] border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-rule-strong text-left">
              <th class="px-4 py-2 font-medium text-ink-2">Date</th>
              <th class="px-3 py-2 font-medium text-ink-2">Bet</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Snapshot</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Taken</th>
              <th class="px-3 py-2 text-right font-medium text-ink-2">Move</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="move in moves" :key="move.bet.id" class="border-b border-rule last:border-b-0">
              <td class="tnum whitespace-nowrap px-4 py-2 text-ink-2">
                {{ shortDate(move.bet.date) }}
              </td>
              <td class="px-3 py-2 text-ink">{{ move.bet.selection }}</td>
              <td class="tnum px-3 py-2 text-right text-ink-2">{{ odds(move.snapshot) }}</td>
              <td class="tnum px-3 py-2 text-right font-semibold text-ink">{{ odds(move.actual) }}</td>
              <td
                class="tnum px-3 py-2 text-right"
                :class="move.drift < 0 ? 'text-critical' : 'text-good'"
              >
                {{ move.drift > 0 ? '+' : '' }}{{ move.drift.toFixed(2) }}
                <span class="text-muted">({{ signedPercent(move.driftPct, 0) }})</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="border-t border-rule px-4 py-2.5 text-[12px] leading-relaxed text-muted">
        A shortened price means the market moved against the bet between planning and placing.
        ROI always uses the taken price, so the drift shown here is information about timing,
        not a number that feeds any return on this dashboard.
      </p>
    </SectionCard>

    <SectionCard title="Rows by bet status">
      <div class="scroll-x">
        <table class="w-full min-w-[360px] border-collapse text-[13px]">
          <tbody>
            <tr v-for="[status, count] in statusCounts" :key="status" class="border-b border-rule last:border-b-0">
              <th scope="row" class="px-4 py-2 text-left font-medium text-ink">
                <code class="text-[12px]">{{ status }}</code>
              </th>
              <td class="tnum px-3 py-2 text-right text-ink-2">{{ count }}</td>
              <td class="tnum px-3 py-2 text-right text-muted">
                {{ percent(count / allBets.length, 0) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  </div>
</template>
