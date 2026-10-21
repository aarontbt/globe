# Signal-to-Exposure Daily Update Guide

**Purpose**: Reference manual for the Energy/LNG Signal-to-Exposure workflow. Routine updates start in `src/data/daily-state.json`; reviewed state is distributed with `bun run daily:apply`.

> **Daily execution**: Load `docs/daily-agent-prompt.md` instead. It holds the 6-step daily flow and its conditional steps. This file is a reference manual for schemas, conventions and rare operations, **not a checklist**. Panel files are generated from `daily-state.json` by `daily:apply`, so the per-file sections below describe fields, not manual edits.
>
> **Energy/LNG ingestion**: See [`energy-lng-data-ingestion.md`](energy-lng-data-ingestion.md) for the active Phase 2 staged connector, provenance and promotion contract. `bun run energy:refresh` produces a fingerprinted candidate/report pair with raw snapshot artifacts and coverage metadata; `bun run daily:update` promotes only a complete, validated same-as-of report whose fingerprint still matches current inputs. `daily:update` is promotion-only and never fetches or recrawls.
>
> **Climate ingestion**: See [`climate-disruption-layer-plan.md`](climate-disruption-layer-plan.md). `bun run climate:refresh` fetches GDACS tropical-cyclone and flood GeoJSON, saves an immutable snapshot, and generates a validated candidate/report pair. Use `bun run climate:refresh --dry-run` to validate the live source without writing artifacts. The next successful `daily:apply` promotes the pair; source failures leave the last promoted model unchanged.
>
> **Satellite weather and cyclone forecasts**: See [`weather-imagery-runbook.md`](weather-imagery-runbook.md) and [`tropical-cyclone-forecast-runbook.md`](tropical-cyclone-forecast-runbook.md). Refresh NOAA/NASA imagery and JMA/NHC forecasts during the daily run, then `daily:update` packages their latest JSON and image assets under `public/data/daily-snapshot/` for the static site build. The browser reads these bundled files; it does not need weather API keys or a separate weather host.

## Current State

| Field | Value |
|-------|-------|
| **Last updated** | 2026-10-21 (D230) |
| **Crisis level** | 4 - High (Reuters on Oct 21 reported Iran's Revolutionary Guards Navy claim that a supertanker caught fire after a mine strike south of Hormuz; this remains source-attributed. Brent is $110.36 and WTI $99.13 in Yahoo snapshots. Official JKM remains $22/MMBtu from Jul 24, carried; the separate JKM-linked CFD was $29.55 on Oct 20. Crisis level and scenario probabilities remain unchanged at 4 and 15/45/40.) |
| **Brent** | $110.36 (2026-10-21, Yahoo Finance BZ=F; +1.443%) |
| **JKM** | $22.00/MMBtu (Reuters, Jul 24, carried); separate JKM-linked CFD $29.55/MMBtu (Trading Economics, Oct 20; not an official assessment) |
| **TTF** | 86.825 EUR/MWh (ICE Endex Nov26 delayed Last, Oct 21 02:44 GMT; not settlement) |
| **Exposure trace** | Oct 21: Reuters reports an Iranian Guards Navy-attributed tanker mine-strike/fire claim south of Hormuz and cites Kpler's report of 18 vessel attacks over two weeks; both remain attributed. |
| **Evidence audit** | 57 checked · 46 verified · 11 carried · 0 unsupported · PASS |
| **Commercial evaluation** | Qatar supply disruption: partial (insufficient verified data); Hormuz delivery constraint: partial (insufficient verified data); Hormuz crude-export constraint: partial (insufficient verified data) |
| **Stale / carried** | 17 carried/estimated; 10 need a replacement source: trace qatar-subchartered-carriers (2026-07-23, 90d), commercial lng-jkm (2026-07-24, 89d), trace hormuz-transits (2026-08-02, 80d), cross-asset asean-ig (2026-08-05, 77d), cross-asset asean-hy (2026-08-05, 77d), cross-asset energy-eq (2026-08-05, 77d), cross-asset shipping-eq (2026-08-05, 77d), cross-asset banks-eq (2026-08-05, 77d), trace oil-vlcc-freight (2026-09-11, 40d), commercial oil-vlcc-freight (2026-09-11, 40d) |

---

## File Inventory

| File | Panel | Update Frequency |
|------|-------|-----------------|
| `src/data/banker-clients.json` | Archived legacy dataset (not rendered) | Per engagement / roster change |
| `src/data/banker-cross-asset.json` | Cross-Asset | Daily (morning) |
| `src/data/banker-conflict.json` | Conflict Status | Daily |
| `src/data/banker-trade-ideas.json` | Archived legacy dataset (not rendered) | On explicit archive maintenance |
| `src/data/banker-sanctions.json` | Archived legacy dataset (not rendered) | On explicit archive maintenance |
| `src/data/commodities-impact.json` | Right panel — Supply Chain tab | Daily (key prices); narratives on material supply chain shift |
| `src/hooks/useMarkets.ts` | Ticker bar (fallback quotes) | Daily |
| `src/components/MarketsWidget.tsx` | Ticker alert banner + oil forecast ranges | Daily |
| `src/data/charts-volatility.json` | Bottom volatility charts (OVX, VXEEM, Scenarios) | OVX + VXEEM fetch live from CBOE on load; only Scenarios need manual daily update |
| `src/data/exposure-traces.json` | Exposure Trace, globe routes and Evidence | Daily inputs; event and contract changes as triggered |
| `src/data/energy-lng-source-registry.json` | Energy/LNG source definitions and fallback rules | Connector contract; change only with parser/validation review |
| `src/data/energy-lng-candidates.json` | Staged normalized Energy/LNG observations | Generated by `bun run energy:refresh`; never hand-promote |
| `src/data/energy-lng-snapshot-manifest.json` | Raw snapshot metadata, hashes and artifact links | Generated by `bun run energy:refresh`; inspect before promotion |
| `src/data/energy-lng-snapshots/` | Durable raw source payloads | Generated by `bun run energy:refresh`; never parse a landing page as data |
| `src/data/energy-lng-runtime.json` | Promoted canonical Energy/LNG domain and assessment lineage | Generated by `bun run daily:apply` |
| `src/data/energy-lng-read-model.json` | Generated Energy/LNG UI read model | Generated and mirrored by `bun run daily:apply` |
| `src/data/climate-source-registry.json` | GDACS endpoint, event types, attribution and freshness contract | Change only with parser/validation review |
| `src/data/climate-candidates.json` and `climate-refresh-report.json` | Staged normalized climate read model and validation report | Generated by `bun run climate:refresh`; never hand-promote |
| `src/data/climate-snapshots/` | Immutable GDACS GeoJSON snapshots and hashes | Generated by `bun run climate:refresh` |
| `src/data/climate-read-model.json` | Promoted Climate panel and globe-layer read model | Generated and mirrored by `bun run daily:apply` |
| `public/weather/manifest.json` | Latest satellite image, polar source links and optional local history catalog | Generated by `bun run weather:refresh`; daily run uses latest-only mode |
| `public/weather/frames/` | Immutable observation manifests and geographic image patches | Generated on weather refresh; never commit binaries or hand-edit timestamps |
| `public/weather/status.json` | Local weather worker check time, last success and failure/skipped-observation report | Inspect each daily run |
| `public/data/daily-snapshot/weather.json` and `cyclones.json` | Latest weather and cyclone data served by the demo | Generated by `bun run daily:snapshot` as part of `bun run daily:update` |
| `public/data/daily-snapshot/weather/` | Latest NOAA infrared and NASA polar PNG assets referenced by `weather.json` | Copied and checksum-verified by `bun run daily:snapshot` |
| `src/data/evidence-audit.json` | Reviewed evidence-validation gate | Every daily run; recrawl changed or due sources |
| `src/data/iran-intel-events.json` | Right panel - Events | Daily |

### Runtime Data Source — READ BEFORE EDITING (critical)

**The core static panel datasets are fetched from `public/data/*.json` at runtime (`useStaticJson`), not from `src/data/`.** `bun run daily:apply` auto-mirrors `daily-state.json`, `exposure-traces.json`, the Energy/LNG runtime/read model, the climate read model, `iran-intel-events.json`, `banker-cross-asset.json`, `banker-conflict.json`, `charts-volatility.json`, and `commodities-impact.json`. `bun run daily:check` rejects drift for all of these.

The Weather panel uses `useWeatherImagery` and `/data/daily-snapshot/weather.json`; cyclone forecasts use `/data/daily-snapshot/cyclones.json`. These tracked build inputs are generated from the local worker manifests by `daily:snapshot`, which also copies only the latest weather image and its polar assets. Optional `VITE_WEATHER_MANIFEST_URL` and `VITE_CYCLONE_MANIFEST_URL` overrides retain the externally hosted feed path. The local worker caches under `public/weather/` and `public/cyclones/` remain Git-ignored.

The archived datasets (not rendered, never part of the daily run) are mirrored by hand only on explicit archive maintenance:

```bash
cp src/data/banker-trade-ideas.json public/data/banker-trade-ideas.json
cp src/data/banker-sanctions.json public/data/banker-sanctions.json
cp src/data/banker-clients.json public/data/banker-clients.json
```


---

## Satellite Weather Operations (daily health review)

1. Refresh the local feeds during the daily run. Use the Python environment and dependency setup in the [weather imagery runbook](weather-imagery-runbook.md):

   ```sh
   . .venv-weather/bin/activate
   bun run weather:refresh --history-hours 0
   bun run cyclone:refresh
   ```

2. Inspect weather `status.json`, the latest `observedAt`, cyclone `sources[]` and advisory issue times. Failed weather/cyclone refreshes retain prior valid data and record provider errors; do not change source timestamps to make carried data appear newer.
3. Run `bun run daily:update`. It promotes and checks the reviewed daily datasets, creates `public/data/daily-snapshot/` from the latest local worker outputs, verifies source PNG sizes and hashes while copying them, and builds the static site. Commit and deploy the updated daily data through the normal repository flow.
4. The browser shows these latest packaged products with their source observation and issue times. Weather data becomes delayed after 26 hours without a newer observation; cyclone advisories retain their issue times and are treated as delayed after 30 hours in the daily package. The static files are fetched on panel open and checked again once per day while the panel remains open.
5. The weather panel ships one current infrared frame and the latest polar composite; it does not ship the local worker's historical playback cache. External `VITE_*_MANIFEST_URL` overrides can still use a separately hosted feed. Do not commit `public/weather/` or `public/cyclones/` worker caches.

Weather imagery is visual context. Retain the separate GDACS footprint-based exposure derivation; imagery alone does not confirm asset disruption, surface wind, rainfall or forecasts.

---

## Source Validation Policy (MANDATORY)

**All data entered into this system must be traceable to a verified source. Fabricated or extrapolated data must never be presented as fact.**

### Verification Tiers

| Tier | Standard | Examples |
|------|----------|---------|
| **Confirmed** | Specific price/figure cited by a named publication with a date | Reuters, QNA, Trading Economics, Bloomberg, Platts assessments |
| **Estimated** | Directionally consistent with confirmed data but exact level not sourced | EM FX, credit spreads, equity indices when real-time data is unavailable |
| **Inferred** | Analytical judgment based on confirmed context | Scenario probabilities, z-score adjustments |

### Rules

1. **Prices (energy, FX, rates, credit)**: Must come from a named source (Reuters, Bloomberg, Trading Economics, Platts, QNA, ICE, EIA, FRED). Do not estimate a price and state it as confirmed. If a price cannot be verified, use the last confirmed price with the confirmation date noted.

2. **Geopolitical events**: Must cite a specific news source (Reuters, AP, Al Jazeera, FT, WSJ, Long War Journal, etc.). Distinguish clearly between:
   - Confirmed actions (e.g., "US sub sank Iranian frigate — confirmed by Al Jazeera, Asia Times")
   - Planned/preparing (e.g., "Kurdish factions preparing offensive per Axios — not yet launched")
   - Analyst forecasts (e.g., "Kuwait/UAE may follow per Reuters analysis")

3. **No extrapolation as fact**: Never state a logical extension of a confirmed event as if it were also confirmed. Example: a confirmed naval escalation does not confirm a separate threat to a different waterway.

4. **EM FX, rates, credit spreads, equity indices**: These are frequently estimated due to limited real-time access. When estimated:
   - Directional moves should be consistent with the macro environment (risk-off = USD up vs EM, spreads wider, rates higher)
   - Do not claim precision beyond the last confirmed close
   - Flag with `(est.)` in internal notes if no source is available

5. **Before committing**: `bun run daily:update` runs the evidence gate. Every confirmed exposure or commercial metric must have directly supporting audited evidence. Assumed or estimated inputs are rejected from the published trace dataset.

### Reviewed Evidence Gate

The live Firecrawl step happens before publishing. Its reviewed output is stored in `src/data/evidence-audit.json`; `daily:update` never recrawls after approval.

For every due or changed evidence URL:

1. Scrape the exact article, release, PDF, official-data page, or market-data page. Category and landing pages are not accepted.
2. Record the final canonical URL, HTTP status, page type, title, publisher, publication date, retrieval time, claim summary, and extracted facts.
3. Map the evidence explicitly to every supported trace hop, confirmed metric, commercial input, derived metric, and counterparty relationship.
4. For a market observation, record its exact value, unit, instrument, provider, source date, and observation timestamp when available.
5. Set `contentStatus` to `verified`, `unsupported`, `stale`, `unreachable`, or `manual-review`, then record the analyst decision in `reviewStatus`.
6. Run `bun run daily:update` (its apply step runs this gate). Run `bun run daily:evidence` on its own only to iterate on audit fixes quickly.

`daily:evidence` and `daily:check` reject:

- unsuccessful or non-HTTPS links;
- broad landing pages;
- unsupported, unreachable, pending, or rejected evidence;
- URL, publisher, publication-date, or last-checked drift;
- unresolved or duplicate evidence IDs;
- evidence reused on a hop or commercial input it was not reviewed to support;
- confirmed or carried metrics and commercial inputs without direct audited support;
- dated market values that do not match their audited value, unit, source date, instrument, or provider;
- counterparty relationships without directly supporting audited evidence;
- carried evidence without both a note and a carry reason.

If Firecrawl cannot retrieve dependable content, do not mark the evidence verified. Carry the prior reviewed observation with its original date and a precise reason, or downgrade the affected metric until a replacement source is approved.

**Switching an evidence source (e.g. Yahoo Finance to Trading Economics) requires a pre-sync step.** The evidence gate (inside `daily:apply`, or standalone `daily:evidence`) validates `evidence-audit.json` against the **currently committed** `src/data/exposure-traces.json` `evidence[]` array, not the post-apply one — `daily:apply` only regenerates `evidence[]` *after* the gate passes. So when a source's `url`/`publisher`/`publishedAt` changes, hand-edit `src/data/exposure-traces.json`'s `evidence[]` entry to match the new evidence-audit entry (and the `traceInputs.evidenceUpdates` block in `daily-state.json`) *before* running `daily:evidence`, otherwise the gate fails on url/publisher/publishedAt/checkedAt mismatches even though the values are internally consistent everywhere else.

**`reviewedAt` and each entry's `checkedAt` must be at or before the real wall clock** (`Date.now() + 5min`), not a rounded-up placeholder — this demo's system clock tracks the in-story date, so a timestamp like `T05:00:00Z` written before checking the actual current time can land in the future and fail with "reviewedAt cannot be in the future." Run `date -u` first and pick a timestamp a few minutes behind it.

### Confirmed Source Map (daily update)

| Asset | Primary Source | Tickers / Access |
|-------|---------------|-----------------|
| Brent crude | Qatar News Agency, Reuters, EIA | Bloomberg `CO1 Comdty`; TradingView `UKOIL` |
| WTI crude | Qatar News Agency, Reuters, EIA | Bloomberg `CL1 Comdty`; TradingView `USOIL`; FRED |
| Dubai/Oman crude | Exact dated Platts, Argus, DME, Reuters or approved equivalent | Manual until a dependable feed is approved |
| TTF Gas | [ICE Endex Dutch TTF futures page](https://www.ice.com/products/27996665/Dutch-TTF-Natural-Gas-Futures/data), manual review | Record the contract and displayed time; the public page labels the quote `Last` and is delayed at least 15 minutes, so do not relabel it as settlement. Yahoo `TTF=F` is retired. Trading Economics documents a historical markets API, but requires subscribed API access and its EU Gas series must be reconciled to ICE before automation. |
| JKM LNG | Reuters (Platts assessment), globallnghub.com | Bloomberg `JKMNEDAN Index`; CME JKM futures |
| EUR/USD | Yahoo Finance machine refresh; ECB cross-check | Yahoo `EURUSD=X`; ECB reference rates |
| SOFR | Federal Reserve Bank of New York API | `markets.newyorkfed.org` |
| LNG/VLCC freight | Exact dated Baltic, Argus, Reuters or approved route assessment | Must state route, cargo/vessel size, unit and date |
| EM FX (SGD, IDR, MYR, THB, PHP) | Reuters, Bloomberg FX | xe.com (directional only) |
| EM Rates | Bloomberg sovereign pages, Investing.com | Tickers: `GIDN10YR`, `GPHL10YR`, `GTHA10YR` |
| iTraxx Asia ex-Japan IG | Bloomberg, Markit | Bloomberg `ITRXAXIG5Y Index` |
| ASEAN HY | BAML ASEAN HY indices, JPMorgan CEMBI | Bloomberg CEMBI |
| Equity Sectors | MSCI ASEAN, SGX | MSCI ASEAN Energy, SGX shipping sub-index, MSCI ASEAN Banks |
| OVX | CBOE daily-history CSV (`OVX_History.csv`) — fetched live on page load; chart shows the trailing 14 calendar days ending at the latest published close | `charts-volatility.json` fallback |
| VXEEM | CBOE daily-history CSV (`VXEEM_History.csv`) — fetched live on page load; chart shows the trailing 14 calendar days ending at the latest published close | `charts-volatility.json` fallback |
| Geopolitical events | Reuters, AP, Al Jazeera, Long War Journal, Axios, FT | PBS NewsHour, Washington Post |

---

## Codebase Conventions

- **Client IDs**: lowercase slugs, no spaces (e.g., `"pttep"`, `"sapura"`, `"wilmar"`)
- **Exposure scores**: integers **1-10** (not 0-10)
- **`change1d` format**: always include sign prefix - `"+7bp"`, `"-3.7%"`, `"+0.4%"`
- **No em dashes**: use ` - ` (space-hyphen-space) in JSON data fields
- **`signal` values**: `"green"` | `"amber"` | `"red"`
- **All dates**: ISO 8601 — `"2026-03-03T08:00:00Z"`
- **Scenario narrative tone**: institutional/banker — factual, instrument-specific, no marketing language
- **Talking points**: 3 per client; each starts with a data point then a recommendation

### Description / Rationale Length Limits

| Field | Hard limit | Guidance |
|-------|-----------|----------|
| Intel event `description` | **150 words** | Lead with current status; move historical detail to a single sentence of context. Remove prior-day inline prefixes (e.g., "Day 5 update:") once superseded — rewrite the whole description. |
| Trade idea `rationale` | **120 words** | Lead with current price/trigger; backstory in ≤1 sentence. |
| `cfTrigger` `description` | **80 words** | Lead with the required action; keep market data to 2-3 figures. |
| `todaysEvents` `summary` | **8 words / 45 chars** | Short signal title only; no dates, sources, or detail. Put explanation in `delta`. |
| `todaysEvents` `delta` | **45 words** | Brief detail shown below the signal title; include source/date/context here. |
| `sec-005` title | **5-8 words** | Replace entirely each day with the single most market-significant event of that session. Do not accumulate. |

---

## 1. Exposure and Commercial Data

The trace dataset is authored in `src/data/exposure-traces.json` at schema version 2 and mirrored automatically. Daily state is schema version 3. Trace observations are controlled from `traceInputs`; commercial observations are controlled from `commercialInputs`.

### Required hop fields

Every trace has exactly five ordered stages: `signal`, `supply`, `transport`, `demand`, `counterparty`.

| Field | Rule |
|-------|------|
| `entityIds` | Every ID must resolve to a public entity |
| `direction` | `positive`, `negative`, or `mixed` |
| `metrics` | Use a verified current value, a dated carried observation, or unavailable |
| `source`, `sourceDate` | Required for confirmed metrics |
| `status` | `confirmed`, `carried`, or `unavailable` |
| `maxAgeDays` | Freshness window enforced by `daily:check` |
| `evidenceIds` | Every ID must resolve to public evidence |
| `missingReason` | Required for unavailable values |

Relationships may only be `public-contract`, `operational-dependency`, or `market-sensitivity`. These labels document public linkages and must never be described as a PETCO position or confidential contract exposure.

### Flow Pressure review

Flow Pressure is generated at runtime from the canonical Energy/LNG adapter; it is not a manually entered field in `exposure-traces.json`. The current `flow-pressure-v1` calculation combines six components:

| Component | Weight |
|-----------|--------|
| Supply interruption | 25% |
| Route / chokepoint pressure | 20% |
| Vessel / port disruption | 15% |
| Destination dependency | 15% |
| Price / basis movement | 15% |
| Alternative availability | 10% |

Each component is scored from 0 (no observed pressure) to 100 (high pressure). A negative, mixed, or positive trace direction starts at 75, 50, or 25 respectively. Carried observations pull the component toward neutral and reduce confidence; fully unavailable observations remain neutral at 50 and are marked unresolved. A market price without an explicit movement, spread, premium, discount, or basis observation remains neutral rather than being interpreted as directional pressure.

Alternative candidates must remain explicitly classified:

- `potential` means a source, market, route, or terminal is a plausible candidate, not verified capacity or execution;
- `physically-feasible` requires evidence for demonstrated capacity, infrastructure compatibility, and route/lead-time constraints;
- `commercially-executable` additionally requires verified cost, contract flexibility, sanctions/insurance, and availability evidence.

Daily operators should update the underlying metrics, directions, evidence links, freshness, and alternative records. Do not write or hand-tune a Flow Pressure score. When `daily:status` reports a trace trigger (and in the weekly review), switch through all traces in **SIGNAL → EXPOSURE** and confirm the score, component statuses, confidence, evidence count, and alternative wording are consistent with the reviewed inputs. A `provisional` or `insufficient verified data` result is expected when required observations are carried or unavailable.

### Key Signals display rule

Key Signals shows the latest observation for each source and unit when it has a value, source, observed period, evidence reference, and a `confirmed` or `carried` status. Direct observations and source-backed `partial-coverage` observations are eligible; partial coverage must be visibly labeled and its caveat retained. A skipped fetch for a manual-only source does not erase coverage verified from its audited observation; connector health remains reported separately. Key Signals does not need to duplicate a trace-hop metric exactly; that cross-model equality check hid valid dated observations. Carried values must remain visibly marked historical with their original dates. Proxy-only, unavailable, identity-only, and placeholder asset-status records remain excluded. A Key Signals display does not promote an observation into a hop metric or commercial calculation; the evidence audit and commercial calculation gates remain unchanged.

### Evidence and retained trace context maintenance

The overlay contains Exposure Trace, Signals, Market Transmission and Evidence. Commercial Evaluation appears only when the selected trace has a verified commercial result. The standalone Counterparties and Actions tabs and the copy-decision-brief control have been removed; do not recreate them during a daily update.

Evidence follows the selected trace and shows the dataset `asOf`, not a new observation date. Review it after a material trace change and during the weekly review. It uses the same promoted trace read model as Exposure Trace; do not maintain a separate tab dataset.

Searchable source rows expand for notes and links. `Historical` means carried; `Review due` means the last check exceeds `maxAgeDays` or is invalid; `Reviewed` describes a reviewed source, not a current cargo or executable trade. Machine retrieval dates and observation dates stay distinct. Maintain audited source metadata, original publication date, last check, carry status and machine snapshot lineage.

Public counterparty relationships remain part of the five-hop trace, globe entities and evidence lineage. They change only after a directly supporting public disclosure or amendment. Never infer a named buyer or cargo allocation from country exposure. The crude-export trace stays unnamed until company evidence is approved. Retained contracts are not new daily events; an agreement starting in 2028 must not imply current supply.

`portfolioAction` and `watchItems` remain compact context within Exposure Trace. They are analyst-authored instructions, not automatically rewritten from market prices. Revisit them when the disruption mechanism, missing inputs, source availability or commercial result changes. Keep pending cost/volume verification explicit; do not replace it with an unsupported execution recommendation.

For structural changes to retained trace context, edit only the authored `counterparties`, `portfolioAction` and `watchItems` fields in the affected `src/data/exposure-traces.json` trace, plus entity/evidence records when required. Audit new relationships before promotion. Then rerun `energy:refresh` so its candidate fingerprint includes those changes, and publish with `daily:update`. Do not hand-edit the energy runtime/read model or public mirrors. Routine dated metrics and evidence updates still come from daily state and the evidence audit.

Evidence coverage includes the selected hops, counterparty relationships, commercial inputs, Flow Pressure, alternatives and physical-flow observations, plus linked machine snapshots. Removing a tab does not remove its underlying evidence or relationship validation. A validated machine snapshot alone does not prove current coverage or commercial eligibility. Missing, carried, stale or unit-incompatible observations remain outside commercial calculations.

### Freshness and carry-forward

| Cadence | Inputs | Review rule |
|---------|--------|-------------|
| Daily | Brent, TTF, JKM, Hormuz transit status, freight/delay ranges, trace headline | Refresh each run; carry only with the original date and a reason |
| Event-driven | Qatar output, force majeure, attacks, reopening, route changes | Change when a sourced event occurs; otherwise retain the latest valid state |
| Contract-driven | Named counterparties and public agreements | Change only after a public disclosure or amendment |

If a dependable source is unavailable:

1. Use `carried` only when the historical observation remains useful and retain its original date.
2. Add a precise `carryReason`; carried values remain outside commercial calculations.
3. Otherwise use `unavailable`, remove value/range/source fields, and add `missingReason`.
4. Never create a midpoint, scenario range, inferred cost, or replacement-volume estimate.

### Three-trace review (when `daily:status` reports a trace trigger, and weekly)

- **Qatar supply disruption**: verify force-majeure status, latest JKM observation, public buyer relationship, and missing current volume/cost data.
- **Hormuz delivery constraint**: verify the latest LNG-specific transit observation, Nakilat relationship, TTF, and current freight-data availability.
- **Hormuz crude-export constraint**: verify EIA flow baselines, current Dubai/Oman and VLCC data, and keep company counterparties unnamed without company evidence.

### Commercial calculation gate

`daily:apply` calculates gross spread, transformation cost, and residual public proxy only when every required input is:

- `confirmed` and inside its freshness window;
- directly supported by an approved evidence-audit observation;
- numeric and in the same currency and physical unit.

Range arithmetic is allowed only for a source-published range. If any operand is carried, unavailable, stale, or unit-incompatible, all derived outputs remain `Insufficient verified data`.

Mechanical residual statuses are `positive residual`, `crosses zero`, `negative residual`, and `insufficient verified data`. They are not profit, margin, or trade recommendations.

---

## 2. Cross-Asset Data (`banker-cross-asset.json`, generated from `daily-state.json` `crossAsset`)

### Field Guidance

| Field | Description |
|-------|-------------|
| `asOf` | Morning snapshot time (08:00 local Singapore, = 00:00Z) |
| `current` | Today's price/level |
| `change1d` | Vs prior close — include sign and unit suffix: `"+7bp"` for rates, `"+1.5%"` for prices |
| `baseline30d` | 30-day rolling average — update monthly |
| `baseline90d` | 90-day rolling average — update quarterly |
| `zscore` | `(current - baseline90d) / stddev`; rough guide: >2.0 = red, 1.0-2.0 = amber, <1.0 = green |
| `signal` | `"red"` if zscore >2.0 or strong move; `"amber"` for moderate; `"green"` for normal |
| `source`, `sourceDate` | Name the provider/instrument and the observation date |
| `observedAt` | Exact market observation timestamp when the source provides one |
| `evidenceId` | ID linking the row to its evidence reference and audit record |

### Categories

1. **Energy** — Brent, TTF Gas, JKM LNG
2. **EM Rates** — Indonesia 10Y, Philippines 10Y, Thailand 10Y
3. **Credit Spreads** — iTraxx Asia ex-Japan IG (bp), ASEAN HY Composite (bp) *(cross-asset panel only; bottom chart uses live VXEEM)*
4. **EM FX** — USD/SGD, USD/IDR, USD/MYR, USD/THB, USD/PHP
5. **Equity Sectors** — ASEAN Energy Equities (idx), Regional Shipping (idx), ASEAN Banks (idx)

---

## 2.5 Ticker Fallback and Red Alert (generated)

`src/hooks/useMarkets.ts` `FALLBACK_QUOTES` is generated from `daily-state.json` `fallbackQuotes`, and its comment comes from `fallbackCommentLines`. `daily:refresh` updates the machine-fetched quotes. `src/components/MarketsWidget.tsx` `TOP_ALERT` is generated from `topAlert`: replace it daily with the single most market-significant event, concise enough for the market panel. Never edit either `.tsx`/`.ts` file directly.

---

## 3. Archived Datasets (not rendered; never part of the daily run)

`banker-clients.json`, `banker-trade-ideas.json` and `banker-sanctions.json` are legacy datasets that no panel renders. Do not update prices, dates, talking points, cfTriggers, retirement checks or sanctions entries during the daily run. Edit them only on an explicit archive-maintenance request, following the existing file schema, and then mirror each one to `public/data/` by hand (see "Runtime Data Source").

---

## 4. Conflict Status (`banker-conflict.json`, generated from `crisis`, `deltaVsYesterday`, `todaysEvents`, `scenarios`)

**Escalation levels 1-5**: Low (no escalation) → Guarded (diplomatic tension) → Heightened (military positioning + sanctions) → High (active strikes/closures, material market impact) → Severe (full theatre conflict, systemic disruption)

### Signals presentation and history

The escalation tier is an analyst assignment, independent of scenario probabilities. The UI displays `Level unchanged` when the level delta is zero. Daily developments show headlines first, with source/date context in expandable detail. Loading or failed data must never display Low as a default assessment.

Scenario cards have equal heights and summaries below the probability bars, limited to three lines. Write a short complete `scenarios[].summary` in daily state (aim for 6-10 words) rather than relying on visual truncation. Keep the complete explanation in `description`. Opening or closing any scenario opens or closes all three together; preserve this behavior when changing the layout.

Signals history shows the last **30 calendar days**, inclusive of the latest saved observation date. `daily:apply` upserts `volatilityDay`, orders snapshots by date, removes observations outside that window and mirrors the result. The default stepped Overview uses equally spaced saved snapshots; Daily columns is an alternate view. Both omit missing dates and explicitly identify the compressed spacing. Never fabricate or interpolate daily probabilities. Selection updates the percentages, changes in percentage points from the first saved snapshot, and the dated update note.

Unchanged probabilities must remain unchanged on the chart. An unchanged period is a valid result, not a reason to manufacture movement. If a retained observation was accidentally trimmed, restore only its latest committed dated record from Git and preserve its provenance; the 30-day window must still apply. Escalation-level history is not available in this dataset and must not be inferred from scenario probabilities.

### `todaysEvents` Convention

- Replace all 3 events each day (do not accumulate)
- Each event `summary` is the short Market Brief signal title: <=8 words or about 45 characters, no dates or source names
- Put the detail, evidence, source/date context, and market implication in `delta`
- `direction`: `"up"` = escalation, `"down"` = de-escalation, `"neutral"` = lateral development
- `deltaVsYesterday`: tracks the **escalation `level` number only** (+1 if level rose vs yesterday, 0 if level unchanged, -1 if level fell). Do not derive it from scenario-probability or tail-% movement — those can shift day to day while the level itself stays flat. Once level is capped at 5 (Severe, the max), `deltaVsYesterday` stays 0 every day the level remains 5, however sharply Base/Stress/Tail move; only a change in the `level` field itself (for example, de-escalation to Level 4) produces a nonzero value.

### Scenario Probability Rules

- Base + Stress + Tail must sum to **100**
- Each scenario `summary` is a short complete sentence (aim for 6-10 words) shown below its probability bar, with a three-line display limit. Keep it aligned with `description`; the full explanation remains expandable.
- As escalation increases: shift probability from Base → Stress/Tail
- As de-escalation occurs: shift Stress/Tail → Base

---

## 7. Supply Chain Impact (`commodities-impact.json`, generated from `commodities`, `commodityScenario`, `marketContext`)

### Purpose

Feeds the **SUPPLY CHAIN** tab on the right panel of the globe. Tracks how the Hormuz crisis propagates beyond energy into food, petrochemicals, fertilizers, and shipping. Unlike `banker-cross-asset.json` (which covers EM financial instruments), this file covers **physical commodity and freight markets** with crisis-specific narrative context.

### Field Guidance

| Field | Description |
|-------|-------------|
| `asOf` | Morning snapshot time — match `banker-cross-asset.json` |
| `scenario` | One-line description of current disruption mechanism; update if macro situation changes materially |
| `supplyChainImpact` | Category-level narrative: why Hormuz closure (or crisis development) affects this category. Update when the underlying mechanism changes — not every day if static. |
| `current` | Today's price/level in the specified unit |
| `change1d` | vs prior close — always include sign: `"+3.2%"` or `"-1.1%"` |
| `baseline30d` | 30-day rolling average — update monthly |
| `baseline90d` | 90-day rolling average — update quarterly |
| `zscore` / `signal` | Same formula and thresholds as cross-asset (§1 Field Guidance) |
| `narrative` | Asset-level crisis context: the specific supply chain mechanism linking this asset to the crisis. Update when the mechanism changes; does **not** need a daily price refresh if the narrative remains accurate. |

### Categories and Benchmark Sources

| Category | Assets | Primary Source |
|----------|--------|---------------|
| **Food & Agriculture** | Wheat (¢/bu), Corn (¢/bu), Soybeans (¢/bu), Palm Oil CPO (MYR/mt), Rice Thai 25% FOB ($/mt) | CME futures (ZW=F, ZC=F, ZS=F); Bursa Malaysia CPO; Bangkok rice export quotes |
| **Petrochemicals & Plastics** | Naphtha CFR Japan ($/mt), Ethylene CFR NE Asia ($/mt), Methanol CFR China ($/mt) | ICIS, Platts, Argus petrochemical assessments |
| **Fertilizers** | Urea FOB Middle East ($/mt), DAP FOB US Gulf ($/mt), Potash MOP CFR SE Asia ($/mt) | Argus Fertilizers, CRU Group, Fertecon |
| **Shipping & Freight** | Baltic Dry Index (pts), VLCC AG-Asia Rate (WS pts), Container Freight SCFI (pts) | Baltic Exchange daily; Clarkson/Platts VLCC WS; Shanghai Shipping Exchange |

### Update Frequency

- **`asOf` + `current` + `change1d`**: Daily — same cadence as `banker-cross-asset.json`
- **`zscore` + `signal`**: Recalculate daily if prices are updated
- **`narrative` (asset-level)**: Update when the supply chain mechanism shifts (new force majeure, route change, facility damage) — not required daily if unchanged
- **`supplyChainImpact` (category-level)**: Update when a new development materially changes the category's exposure mechanism
- **`scenario` (top-level)**: Update when the primary disruption vector changes (e.g., Hormuz partially reopens, Cape re-routing reverses)

### Source Validation Notes

- **Naphtha, ethylene, methanol**: Exact levels require ICIS/Platts subscription. If unavailable, estimate directionally from crude oil move (naphtha tracks crude closely; ~70% correlation). Flag as `(est.)`.
- **Urea FOB ME / DAP**: Argus and CRU assessments are weekly — use last confirmed weekly level on non-assessment days; apply directional adjustment if major news.
- **VLCC WS rates**: Clarkson or Platts Dirty Tanker index is the primary source. Spot rate can move 20–30 WS points intraday on single fixture — use last confirmed Baltic/Clarkson close.
- **Baltic Dry Index**: Published daily by Baltic Exchange; available via Trading Economics or Bloomberg `BDIY Index`.
- **SCFI**: Published weekly by Shanghai Shipping Exchange (Friday). Use last confirmed weekly value on non-publication days.

*Rare ops (adding/retiring assets or categories): follow structure in the actual file. Do not use `signal: "green"` as a proxy for retirement — remove the asset object entirely.*

---

## 8. Data Hygiene & Pruning

### Intel Events (`iran-intel-events.json`)

**What to refresh daily (not just `ship-001` / `sec-005`):**

| Event ID | Stale field | Action |
|----------|------------|--------|
| `ship-001` | Entire description | Rewrite — do not prepend "Day N update:". Lead with current AIS transit count, trapped tanker count, and most recent attack. ~100 words max. |
| `sec-005` | Title + description | Replace title with today's top security event. Rewrite description as a concise current summary, not an accumulating log. |
| `supply-001` | Description | Refresh price figures (Brent, JKM, TTF) and AIS transit count. Rewrite, do not prepend. |
| `energy-003` | Description (Brent price) | Update Brent figure to current level; update analyst forecasts if materially changed. |
| `trade-001` | Description (Brent price, range) | Update "currently trading ~$X/bbl" to today's Brent. |
| `trade-003` | Description (Brent price) | Update Brent figure; update analyst forecast threshold if needed. |
| `diplo-003` | Description | Add one sentence for any new ASEAN diplomatic development; trim oldest detail to maintain ≤150 words. |

**When to retire an intel event entirely:**
- Event's underlying condition is fully resolved (e.g., a chokepoint re-opens)
- Probability has dropped below 15% and the narrative is no longer forward-looking
- The event has been superseded by a more specific/updated event (e.g., `ship-001` replaces the generic `energy-001` Hormuz description once the crisis is established)

**Do not** delete `energy-001` through `supply-004` purely because they are old — they represent structural risks still on the board. Only retire if explicitly resolved.

### Runbook Self-Maintenance

- **Crisis timeline archive** (`docs/crisis-timeline-archive.md`): generated from `timelineEntry`, one line per day of 25 words or fewer. Fix past lines only when they are factually incorrect.
- **Current State and Price Narratives**: generated from `runbookState`, `priceNarratives` and the evidence and stale summaries. Never edit them directly.

---

## Daily Field Map

The daily flow lives in `docs/daily-agent-prompt.md`. This table maps each panel to the hand-edited input that drives it.

| Panel / file | Edit this | Notes |
|--------------|-----------|-------|
| Ticker bar (`useMarkets.ts`) | `fallbackQuotes`, `fallbackCommentLines` | Machine quotes come from `daily:refresh` |
| Red alert (`MarketsWidget.tsx`) | `topAlert` | Single top event |
| Cross-asset | `crossAsset` | Only rows with a new sourced value; others stay carried or estimated |
| Conflict, Market Brief | `crisis`, `deltaVsYesterday`, `todaysEvents`, `scenarios` | Scenarios sum to 100 |
| Bottom charts | `volatilityDay` | Scenarios must match `scenarios`; history is auto-trimmed to the last 30 calendar days |
| Supply chain | `commodities`, `commodityScenario`, `marketContext` | Narratives only when the mechanism changes |
| Signal → Exposure, globe, Key Signals | `traceInputs`, `commercialInputs` | Evidence in `evidence-audit.json` |
| Events | `src/data/iran-intel-events.json` (hand-edited, auto-mirrored) | See §8 |
| Satellite weather and animated clouds | No manual data edits; inspect weather status and run `weather:refresh` as needed | Separate generated imagery pipeline; see Satellite Weather Operations |
| Runbook state, timeline | `runbookState`, `priceNarratives`, `timelineEntry` | — |

### Weekly Review

- [ ] **Scenario probabilities**: recalibrate Base/Stress/Tail based on the geopolitical trajectory
- [ ] **Baseline30d**: update the rolling 30-day averages in `crossAsset` and `commodities`
- [ ] **Long-carried items**: work through every `!` item in `daily:status`. Find a replacement source, or downgrade it to `unavailable` when the carried value no longer helps
- [ ] **Browser review**: three traces, Flow Pressure, and the E2E recipe below
- [ ] **Climate**: run `bun run climate:refresh`
- [ ] **Animated weather**: review real-frame playback, scrubbing, Latest, observation timestamps, opacity and independent hazard visibility; verify the configured worker's freshness and failure recovery

---

## E2E Verification Recipe (weekly, or after UI or script changes)

1. `bun run dev` → open `http://localhost:5173`
2. Open **SIGNAL → EXPOSURE**, switch through all three traces, and verify that the five-hop chain, Flow Pressure score/components/confidence, verified-data statuses, evidence, commercial evaluation and portfolio action update together
3. Close the overlay and verify the globe shows only the selected trace route, with LNG production/carrier/terminal/demand nodes and no stale route from the previous selection
4. Open **Signals**: scenario summaries sit below the bars and show at most three lines; all scenario cards expand/collapse together and have equal heights. Check Overview and Daily columns against the last 30 calendar days of saved snapshots; date selection updates values and the update note. Missing dates are omitted, not fabricated.
5. Open **Evidence**, switching through all three traces. Search by publisher/date and confirm historical/review-due labels, publication/check dates and machine observation/retrieval dates remain distinct. Verify that Counterparties and Actions are absent from navigation; relationship evidence and compact action/watch context still resolve within the trace.
6. Right panel, **EVENTS**: intel events are visible, there are no `pm-` events, and the filters work
7. Right panel, **SUPPLY CHAIN**: all 4 categories are present, `asOf` matches today, and asset rows expand
8. **Weather** toolbar button → **Weather** details popup (playback controls must appear only here; the toolbar label must not change size with loading status): verify infrared imagery, UTC observation time, opacity, Play/Pause, timeline scrubbing and Latest. Historical selection must show its own timestamp without marking a fresh latest source stale. Disruption Hazards must toggle independently. Confirm stale/unavailable warnings, a failed frame retaining the prior image and pausing playback, and disabling imagery stopping new frame requests. Confirm MODIS thermal infrared at both poles without radial spokes or solid-white cap artifacts and its separate daily date; never stretch equatorial imagery into a cap.
9. Browser console: no errors
10. Verify at 1280×720 and 1440×900: no clipped chain cards, tabs, weather controls or action controls

Source/runtime mirror drift and the evidence gate are enforced by `bun run daily:update`, so they need no manual diff.

---

## Narrative Conventions (Iran Escalation Scenario)

### Archived Crisis Log

The permanent day-by-day crisis history lives in `docs/crisis-timeline-archive.md`. Daily updates append one line to that archive only; this runbook should keep current-state and schema guidance, not the full historical log.

### Price Narratives (generated from `daily-state.json` `priceNarratives`)

> Edit `priceNarratives` in daily state, not this section. Replace the prior-day levels, and keep no more than the 3 most significant historical inflection points.

- **Brent**: Pre-shock ~$65 -> $126 wartime intraday high (Apr 30, CNBC/CNN) -> $110.36 (Yahoo Finance BZ=F, Oct 21 snapshot, +1.443%). Working range $75-85 base; $85-105 stress; $105-135+ tail.
- **JKM LNG**: Baseline $9.5 -> $23.40/MMBtu (Reuters/Platts) -> official $22.00/MMBtu (Jul 24 Reuters September-delivery assessment, carried). Separate JKM-linked CFD was $29.55/MMBtu on Oct 20 (-1.53%; Trading Economics); not an official assessment.
- **TTF Gas**: Pre-shock ~$34/MWh -> 63.58/MWh (Jul 24, MacroMicro) -> 86.825 EUR/MWh (ICE Endex Nov26 delayed Last, Oct 21 02:44 GMT; not settlement). Selective LNG passages do not establish unrestricted Hormuz access.
- **Credit**: iTraxx Asia IG est. ~138bp and ASEAN HY est. ~475bp (Aug 5), both carried as estimates; Oct 21 targeted search found no newer comparable public series. No source-approved daily credit marks are available. Scenario split remains base 15%, stress 45%, tail 40%.

### BottomChartsPanel (`src/data/charts-volatility.json`, generated from `volatilityDay`)

**OVX and VXEEM are fetched live from the CBOE CDN on page load**, so no manual daily values are needed. Each chart shows 14 calendar days, ending on the latest date in its CBOE history CSV. Missing dates, including weekends and exchange holidays, carry forward the most recent prior close and appear as hollow points. If the fetch fails, the existing `ovx` / `vxeem` values remain the fallback.

Set `volatilityDay` in daily state. `daily:apply` upserts it into `days` and keeps snapshots from the last 30 calendar days (inclusive of the update date; missing dates are not filled):

```json
{
  "day": "D11",
  "date": "2026-03-11",
  "ovx": 107.44,
  "ovxConfirmed": true,
  "vxeem": 27.0,
  "vxeemConfirmed": false,
  "scenarios": [22, 54, 24],
  "scenariosConfirmed": true
}
```

**Rules:**
- `scenarios` must sum to **100** and match `banker-conflict.json` scenario probabilities exactly.
- Set `ovx` / `vxeem` to the latest reviewed closes as fallback values (used if the CBOE fetch fails); set `Confirmed: false` when those values have not been checked for the update.
- Continue the `day` label (`D11`, `D12`, …) for the scenario history rows. The live CBOE charts generate their own calendar-date labels.
- The peak annotation (`▼ -N from peak`) auto-calculates — no manual edit needed.
