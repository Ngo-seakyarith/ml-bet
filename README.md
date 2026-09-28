# MLBB Strategy Lab

A data-driven betting research dashboard for analysing Mobile Legends esports betting
strategies. The application uses a CSV file as its source of truth and recalculates every
statistic whenever that file changes.

The system compares Match Winner and Correct Score 2-0 strategies while keeping Over 2.5 bets
separate. It tracks hit rate, ROI, conditional sweep probability, odds groups, weekly
performance, league performance, upset frequency, market movement and a running total.

Every tracked pick counts, whether or not it was actually backed. The dashboard measures the
method, not an account balance. It does distinguish actual, snapshot and estimated odds, so
reconstructed backtest prices never get mistaken for prices anyone could have taken.

Its purpose is not to record wins and losses, but to find out whether repeatable patterns
exist — whether certain odds ranges, leagues, weeks or market conditions produce better Match
Winner or 2-0 opportunities.

## Running it

```bash
bun install
bun run dev
```

| Script             | What it does                          |
| ------------------ | ------------------------------------- |
| `bun run dev`      | Dev server with hot reload            |
| `bun run build`    | Typecheck, then production build       |
| `bun run typecheck`| Typecheck only                        |
| `bun run preview`  | Serve the production build            |

## Updating the data

The dataset lives at `src/data/mlbb_betting_dataset.csv`. Edit it and save — Vite reloads the
file and every figure recalculates. There is no upload step, no database and no browser
storage.

Blank means "not applicable" everywhere. A bet with no usable price is left out of ROI rather
than counted at evens.

### Columns that drive the analysis

| Column                                             | Why it matters                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `winner_odds`, `winner_pick_result`                 | The Match Winner strategy, independent of which market was played     |
| `selected_maps`, `opponent_maps`                    | Decides the 2-0 outcome — our bet wins only when **our** team sweeps  |
| `strategy_market`                                   | `2-0` or `Over 2.5`; these are never pooled                           |
| `strategy_odds_actual` / `_snapshot` / `_estimated` | Price priority, in that order                                         |
| `strategy_result`                                   | `VOID/POSTPONED` drops the row from every rate and return             |

## How the numbers are defined

**Everything derived is recomputed from the raw columns**, not read from the CSV's stored
profit fields. Those stored fields are still checked against the recomputation, and any
disagreement is reported on the Data page.

- **Conditional sweep rate** — `P(2-0 | selected team wins)`, the count of correct winner picks
  that finished 2-0 divided by all correct winner picks. This is the headline figure because
  it isolates the half of the bet the 2-0 market actually prices. The raw 2-0 hit rate is also
  shown, but it is depressed by every match where the winner pick was simply wrong.
- **Odds groups** — derived from `winner_odds` (G1 1.01–1.19 … G5 2.00+). There is no group
  column to fill in.
- **ROI** — flat one-unit stakes. Profit is `odds - 1` on a win and `-1` on a loss. Voided and
  postponed matches are excluded from every rate and return rather than counted as pushes.
- **Upset rate** — favourite selections (winner odds under 2.00) that lost outright.
- **Confidence intervals** — Wilson score intervals, which behave sensibly on small samples
  and rates near 100% where the normal approximation runs off the end of the scale.

### Sample size is shown, not hidden

Every rate carries a marker: `●` usable, `◐` thin (under 25), `○` anecdote (under 10). A
return built on six bets is one result away from looking completely different, and the
interface says so rather than letting a large percentage imply reliability.

## What is counted

Every tracked pick, at one flat unit. There is no separate "real money" view: which bets were
actually staked was never recorded reliably, so splitting the dataset on it produced a
misleadingly small sample rather than a second useful number. The running total on the
Bankroll page is what flat staking every pick would have returned — the method's result, not
an account statement.

Two things are still excluded:

- **Postponed fixtures**, which never resolved, via `VOID/POSTPONED` in the result columns.
- **Estimated prices**, behind a toggle. Any 2-0 price in `strategy_odds_estimated` — the
  interpolated Sep 4-6 reconstruction and later approximate ("~") prices — can be switched off
  to see only prices that were actually observed.

## Stack

Vue 3 + TypeScript on Vite, Tailwind v4, PapaParse and Zod for parsing and validation,
TanStack Table v9 for the match table, TanStack Charts for the plots. No backend.

The statistics engine in `src/lib/stats.ts` is pure and framework-free — it takes `Bet[]` and
returns numbers, with no Vue imports — so it can be tested or reused directly.

```
src/
  data/       the CSV — the source of truth
  lib/        parse.ts, stats.ts, types.ts, format.ts, palette.ts
  composables/ reactive dataset, filters and colour scheme
  components/ UI primitives, shared segment table, charts
  pages/      Dashboard, Matches, Odds groups, Weeks, Leagues, Bankroll, Data
```
