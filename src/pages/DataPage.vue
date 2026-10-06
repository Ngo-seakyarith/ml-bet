<script setup lang="ts">
import { computed } from 'vue'
import { useDataset } from '../composables/useDataset'
import { oddsQualityBreakdown } from '../lib/stats'
import SectionCard from '../components/ui/SectionCard.vue'
import StatTile from '../components/ui/StatTile.vue'
import RawCsvTable from '../components/RawCsvTable.vue'

const { allBets, issues } = useDataset()

const errors = computed(() => issues.value.filter((issue) => issue.severity === 'error'))
const warnings = computed(() => issues.value.filter((issue) => issue.severity === 'warning'))
const quality = computed(() => oddsQualityBreakdown(allBets.value))

</script>

<template>
  <div class="flex flex-col gap-4">
    <SectionCard
      title="mlbb_betting_dataset.csv"
      note="Every value exactly as written in the CSV, newest weekend first. Edit the CSV and save; this table updates with it."
    >
      <RawCsvTable />
    </SectionCard>

    <section class="stat-grid" data-cols="3">
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
        <p class="max-w-[72ch] text-muted">
          Correct-score prices follow selected_team/opponent order. Your bet's price is read from
          the matching market column (2-0 or Over 2.5), so put the price you actually got there.
          +1.5 is recorded for each team separately, and a blank means the line was not listed.
          Use the single notes column only for things the other columns cannot show.
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
        All {{ allBets.length }} rows parsed cleanly, and every score agrees with its result.
      </p>
    </SectionCard>

    <SectionCard
      title="Price quality"
      note="Estimated prices (written with ~ in the CSV) are backtest or approximate prices, not ones you could take."
    >
      <div class="stat-grid" data-cols="3" data-flush>
        <StatTile label="Observed" :value="String(quality.observed)" support="Price seen on the bookmaker" />
        <StatTile
          label="Estimated"
          :value="String(quality.estimated)"
          support="Written as ~price"
          :tone="quality.estimated > 0 ? 'bad' : 'flat'"
        />
        <StatTile label="No price yet" :value="String(quality.none)" support="Left out of ROI" />
      </div>
    </SectionCard>

  </div>
</template>
