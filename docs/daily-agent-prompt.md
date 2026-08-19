# Daily Agent Prompt - Signal to Exposure

> Routine daily updates start from `src/data/daily-state.json` (schema version 3).
> Consult `docs/daily-update-runbook.md` for field definitions, freshness policy, carry rules, or rare operations.
> The active Energy/LNG ingestion layer is specified in [`energy-lng-data-ingestion.md`](energy-lng-data-ingestion.md); it produces staged candidates and must not bypass the promotion gates.

## Daily Workflow

1. **Preview** - run `bun run daily:fetch -- --dry-run`. Confirm the preview includes Brent, WTI, Dutch TTF, EUR/USD, and SOFR. This command must not change files.
2. **Refresh** - run `bun run daily:refresh`. This persists successfully fetched liquid values to daily state but does not publish them.
3. **Refresh Energy/LNG candidates** - run `bun run energy:refresh`; use `bun run energy:refresh -- --event` after a material disruption change. Review the source snapshots, machine evidence, carried/unavailable outcomes, and promotion report. This command does not change promoted runtime data. Configure `EIA_SERIES_ID` for the EIA series and `PORTWATCH_DATA_URL` (plus `PORTWATCH_ROUTE_ID` when required by the endpoint) for PortWatch; unconfigured selectors fail closed to the declared fallback.
4. **Audit evidence** - use Firecrawl to scrape every due or changed URL in `src/data/exposure-traces.json`, then update the reviewed results in `src/data/evidence-audit.json`.
   - Verify the canonical URL, HTTP status, page type, title, publisher, publication date, extracted facts, and direct claim support.
   - For market observations, record the exact value, unit, instrument, provider, source date, and observation timestamp when available.
   - Mark unsupported, unreachable, landing-page, or ambiguous content for review; never approve it automatically.
   - Run `bun run daily:evidence`. Resolve every failure before continuing.
5. **Complete verified physical inputs** - edit `src/data/daily-state.json`:
   - Update `asOf`, `day`, crisis fields, alerts, scenarios, and `timelineEntry`.
   - Under `traceInputs.metrics`, review JKM, Hormuz transit condition/count, Qatar output/force-majeure status, EIA oil-flow baselines, and the trace headline.
   - Under `commercialInputs`, review Dubai/Oman, LNG and VLCC freight, war-risk costs, current origin/destination values, EUR/USD, and SOFR.
   - Every published value needs exact evidence, `source`, and `sourceDate`. Do not enter analyst estimates, assumed ranges, or placeholder values.
   - If a prior observation is still useful, keep its original date and mark it `carried`; it will display but cannot enter a calculation.
   - If no dependable value exists, set `status: "unavailable"`, remove value/range/source fields, and add `missingReason`.
6. **Rerun after edits** - if evidence, state, exposure, or source configuration changes after the Energy/LNG refresh, rerun `bun run energy:refresh`. The report fingerprint is intentionally stale until refreshed.
7. **Review all three traces** - check Qatar supply disruption, Hormuz delivery constraint, and Hormuz crude-export constraint. Oil counterparty stages remain unnamed unless company-level evidence is approved.
8. **Review Flow Pressure** - the score is generated from the reviewed trace directions, observations, freshness, evidence, and alternative candidates; do not manually edit or tune the score. In **SIGNAL → EXPOSURE**, check all six component statuses and weights, confidence, evidence count, and ensure `potential` alternatives are not described as executable.
9. **Review commercial evaluation** - residual calculations must remain unavailable unless every required input is current, verified, unit-compatible, and directly audited.
10. **Publish** - run `bun run daily:apply -- --dry-run`, review the proposed files, then run `bun run daily:update`. The apply gate promotes only a complete, validated candidate/report pair with the current `asOf` and refresh fingerprint; it stages and validates the full output bundle before writing.

`daily:update` first enforces the reviewed evidence gate, then applies state, mirrors runtime data, validates, and builds. It never refetches or recrawls after review.

## Cadence and Source Rules

- **Daily**: Brent, WTI, TTF, EUR/USD, SOFR, JKM, Dubai/Oman, Hormuz transit status, route-normalised freight, war-risk cost, and trace headline.
- **Event-driven**: Qatar production, force majeure, attacks, reopening, and routing changes.
- **Contract-driven**: named counterparties and public supply agreements.
- Yahoo Finance with Stooq fallback is allowed for liquid instruments. Dutch TTF uses Yahoo `TTF=F`.
- JKM, Dubai/Oman, LNG/VLCC freight, AIS/transit counts, Qatar output, force majeure, and war-risk costs remain manually verified unless a dependable machine-readable source is approved.
- Missing data is published as unavailable. Carried or stale values never enter commercial calculations.
- Relationships must be typed as `public-contract`, `operational-dependency`, or `market-sensitivity`.
- Broad landing pages are not valid evidence. Dynamic quote pages require a dated observation snapshot before they can support a historical metric.

## Generated Outputs

`bun run daily:apply` distributes reviewed state into:

- `src/data/daily-state.json` and `public/data/daily-state.json`
- `src/data/exposure-traces.json` and `public/data/exposure-traces.json`
- `src/data/energy-lng-candidates.json` and `src/data/energy-lng-refresh-report.json` (staged inputs)
- `src/data/energy-lng-runtime.json`, `src/data/energy-lng-read-model.json`, and their `public/data/` mirrors
- `src/data/iran-intel-events.json` and `public/data/iran-intel-events.json`
- `src/data/banker-cross-asset.json`
- `src/data/banker-conflict.json`
- `src/data/charts-volatility.json`
- `src/data/commodities-impact.json`
- `src/hooks/useMarkets.ts`
- `src/components/MarketsWidget.tsx`
- `docs/daily-update-runbook.md`
- `docs/crisis-timeline-archive.md`

Do not edit generated daily fields directly.
`src/data/evidence-audit.json` is a reviewed input, not a generated output.

## Required Validation

- `bun run daily:evidence`
- `bun run daily:test`
- `bun run daily:check`
- `bun run build`

All three are included in `bun run daily:update`.
