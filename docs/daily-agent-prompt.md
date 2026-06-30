# Daily Agent Prompt - ASEAN Globe Market Brief

> Routine daily updates start from `src/data/daily-state.json`.
> Consult `docs/daily-update-runbook.md` only for schema guidance, source policy, or rare operations.

## Daily Workflow

1. Run `bun run daily:fetch -- --dry-run` to check liquid market fetches for Brent, WTI, and gold.
2. Edit `src/data/daily-state.json`:
   - Update `asOf`, `day`, `crisis`, `deltaVsYesterday`, alert/range fields, and `timelineEntry`.
   - Update all sourced values with `source`, `sourceDate`, and `status`.
   - Replace all 3 `todaysEvents`; use `summary` as a short signal title and `delta` for detail/source context; keep scenario probabilities summing to 100.
   - Update `marketContext`, `commodityScenario`, and price narratives only when the market state changes.
3. Run `bun run daily:apply -- --dry-run` and review the files it would update.
4. Run `bun run daily:update`.
5. If `daily:update` fails, fix `src/data/daily-state.json` first unless the error identifies a real schema or script bug.

## Source Rules

- Confirmed liquid prices may come from Yahoo Finance, Stooq, TradingEconomics, Reuters, EIA, or another named source with a date.
- If Brent, WTI, or gold fetch fails, carry the previous value and mark `status: "carried"`; do not invent confirmed energy prices.
- EM FX, EM rates, credit, equities, and commodity benchmarks may be `estimated` only when directionally supported and explicitly marked.
- Event summaries and scenario probabilities remain human/agent judgment; do not auto-generate them from price moves alone.

## Generated Outputs

`bun run daily:apply` distributes `src/data/daily-state.json` into:

- `src/data/banker-cross-asset.json`
- `src/data/banker-conflict.json`
- `src/data/charts-volatility.json`
- `src/data/commodities-impact.json`
- `src/hooks/useMarkets.ts`
- `src/components/MarketsWidget.tsx`
- `docs/daily-update-runbook.md`
- `docs/crisis-timeline-archive.md`

Do not edit those generated daily fields directly during routine updates. Use the runbook for rare operations such as adding a client, sanctions entry, asset, or category.

## Required Validation

- `bun run daily:check`
- `bun run build`

Both are included in `bun run daily:update`.
