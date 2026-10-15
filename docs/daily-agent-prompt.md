# Daily Agent Prompt - Signal to Exposure

> The daily update has three inputs you edit by hand: `src/data/daily-state.json` (schema version 3), `src/data/evidence-audit.json` (reviewed evidence) and `src/data/iran-intel-events.json` (Events panel). Every other panel file is generated from them by `bun run daily:apply`.
> Use `docs/daily-update-runbook.md` only to look up field definitions, freshness and carry rules, or rare operations. Do not follow it as a checklist.
> Energy/LNG ingestion contract: [`energy-lng-data-ingestion.md`](energy-lng-data-ingestion.md).

## Daily Workflow (6 steps)

1. **Refresh liquid markets**: run `bun run daily:refresh`. It fetches Brent, WTI, EUR/USD and SOFR into daily state and does not publish. `git diff src/data/daily-state.json` is the preview, so there is no separate dry run. A failed fetch carries the prior value with its original date.
2. **Plan the run**: run `bun run daily:status`. It prints:
   - **Evidence to scrape**: items that are overdue, expire before the next run, have a changed URL, or whose `lastChecked` no longer matches the audit (for example, machine-refreshed by step 1). This list is the complete scrape scope.
   - **Stale / carried / estimated**: every held observation with its age. Items marked `!` are past their cadence. Make one targeted search for a replacement source; if none is found, keep the item carried with an updated reason.
   - **Review triggers**: whether a trace or commercial review is needed (see Conditional Steps).
3. **Audit evidence**: run Firecrawl on **only** the listed URLs, plus the exact articles behind today's new events. Update `src/data/evidence-audit.json`:
   - Record the canonical URL, HTTP status, page type, title, publisher, publication date, extracted facts and direct claim support. For market observations, also record the exact value, unit, instrument, provider, source date and observation timestamp.
   - For Yahoo Finance and New York Fed API endpoints, add a one-time `cachebust=<UTC-run-id>` query parameter when the canonical response is stale. Keep the canonical URL in the record.
   - Never approve unsupported, unreachable, landing-page or ambiguous content.
   - Run `date -u` first. `reviewedAt` and each `checkedAt` must not be in the future.
   - When switching an evidence source, hand-sync the matching `exposure-traces.json` `evidence[]` entry first. See the runbook section "Reviewed Evidence Gate".
4. **Edit `daily-state.json`**: set `asOf`, `day`, `crisis`, `deltaVsYesterday`, `topAlert`, `todaysEvents`, `scenarios`, `volatilityDay`, `priceNarratives`, `runbookState`, `timelineEntry`, `traceInputs` (headline, metrics, evidenceUpdates) and `commercialInputs`.
   - Every published value needs exact audited evidence, a `source` and a `sourceDate`. Never enter estimates, assumed ranges or placeholders.
   - Keep a still-useful prior observation `carried`, with its original date and a `carryReason`. If no dependable value exists, mark it `unavailable` with a `missingReason`.
   - Set `commodities`, `commodityScenario`, `marketContext`, `crossAsset` and `fallbackQuotes` only for values that changed today.
   - **Intel events** (`src/data/iran-intel-events.json`): rewrite `ship-001`, `sec-005` (title of 8 words or fewer) and `supply-001`, and update the Brent figure in `energy-003`, `trade-001` and `trade-003`. Each description is 150 words or fewer, with no "Day N update:" prefixes. `daily:apply` mirrors the file.
   - Do **not** edit generated files: cross-asset, conflict, charts, commodities, `useMarkets.ts`, `MarketsWidget.tsx`, the runbook state rows, the timeline, the trace or energy runtime files, or `public/data/`.
5. **Stage Energy/LNG once**: run `bun run energy:refresh` after **all** state and evidence edits. Add `-- --event` after a material disruption change. If you edit state or evidence again afterwards, rerun it, because the fingerprint must match.
6. **Publish**: run `bun run daily:update`. This single gate runs apply (including the evidence gate, energy and climate promotion, and staged bundle validation), then check, then build. Fix any failure and rerun. Review `git diff --stat`, then commit.

## Conditional Steps (only when triggered)

| Step | Trigger |
|------|---------|
| `bun run daily:test` | Anything under `scripts/` or `scripts/fixtures/` changed |
| Browser review of SIGNAL → EXPOSURE (Flow Pressure, five-hop chain, counterparties, alternatives) | `daily:status` lists a trace trigger, or the weekly review |
| Commercial evaluation review | `daily:status` reports that a commercial input became usable. While Dubai/Oman, freight and war-risk inputs are unavailable or carried, all three traces stay `insufficient verified data`, and `daily:check` already proves the result is reproducible. |
| Manual TTF review on the [ICE Endex page](https://www.ice.com/products/27996665/Dutch-TTF-Natural-Gas-Futures/data) | `ttf` is due or carried in `daily:status`. Record the contract and displayed time, and keep the delayed `Last` quote distinct from settlement. |
| `bun run climate:refresh` | Weekly, or when a GDACS cyclone or flood event is active near a traced asset |
| Full E2E recipe (runbook) | Weekly, or after UI or script changes |
| Archived datasets (clients, trade ideas, sanctions) | Never in the daily run; they are not rendered |

## Cadence and Source Rules

- **Daily**: Brent, WTI, EUR/USD and SOFR (machine); TTF, JKM, Dubai/Oman, Hormuz transit status, route-normalised freight, war-risk cost and the trace headline (manual, only when due or newly reported).
- **Daily**: IMF PortWatch Hormuz vessel counts come from the official chokepoint layer. The route-pressure score stays unavailable unless it is directly sourced.
- **Annual**: EIA Qatar production and export baselines, GEM terminal capacity and status, and UN/LOCODE identity snapshots.
- **Event-driven**: Qatar production, force majeure, attacks, reopening and routing changes.
- **Contract-driven**: named counterparties and public supply agreements.
- Yahoo Finance with a Stooq fallback is allowed for selected liquid instruments. Dutch TTF and UN Comtrade are retired from automatic refresh.
- Missing data is published as unavailable. Carried or stale values never enter commercial calculations.
- `bun run daily:update` is promotion-only: it must not fetch, recrawl or create scheduler infrastructure.
- Relationships must be typed as `public-contract`, `operational-dependency` or `market-sensitivity`.
- Broad landing pages are not valid evidence. Dynamic quote pages need a dated observation snapshot before they can support a historical metric.
- EIA series require `EIA_API_KEY` in `.env`. PortWatch uses the keyless ArcGIS layer in the source registry (`PORTWATCH_DATA_URL` only overrides it). Ras Laffan capacity comes from the reviewed QatarEnergy LNG snapshot, which is refreshed annually. Ras Laffan status is a reviewed value: update `ras-laffan-asset-status` whenever you update `qatar-output-status`.

## Generated Outputs (never hand-edit)

`bun run daily:apply` writes `daily-state.json`, `exposure-traces.json`, the energy runtime and read model, the climate read model, `banker-cross-asset.json`, `banker-conflict.json`, `charts-volatility.json` (keeping the last 12 scenario days), `commodities-impact.json` and their `public/data/` mirrors, including `iran-intel-events.json`. It also writes `src/hooks/useMarkets.ts`, `src/components/MarketsWidget.tsx`, the Current State and Price Narratives in `docs/daily-update-runbook.md`, and `docs/crisis-timeline-archive.md`. `energy:refresh` writes the energy candidates, refresh report, snapshot manifest and snapshots.
