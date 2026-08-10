# Signal-to-Exposure Daily Update Guide

**Purpose**: Reference manual for the Iran-Hormuz public-intelligence demonstrator. Routine updates start in `src/data/daily-state.json`; reviewed state is distributed with `bun run daily:apply`.

> **Daily execution**: Load `docs/daily-agent-prompt.md` instead — it is the lean, token-efficient daily prompt. This file is the reference manual for schemas, conventions, and rare operations.

## Current State

| Field | Value |
|-------|-------|
| **Last updated** | 2026-08-10 (D159) |
| **Crisis level** | 4 - High (Aug 10: Iran's Supreme National Security Council set new conditions to reopen Hormuz on Aug 8 - lifting the US naval blockade and sanctions, withdrawing US forces, paying war reparations and releasing frozen Iranian assets - saying the Strait 'will not be reopened' until Washington 'corrects its behavior' (CNN, Aug 8). The same day ADNOC confirmed one of its vessels was struck by a missile transiting Hormuz; 15 ADNOC vessels have been targeted since Feb 28, three this week alone, killing one crew member and injuring 20 (Al Jazeera/Gulf News, Aug 8). Kpler data via Middle East Eye (Aug 8) shows just 8 confirmed Hormuz crossings on Aug 7, down 33% day-on-day, with most vessels using Iran's Unilateral Scheme, while Bab el-Mandeb crossings rose 18% to 26. Iran's FM Araghchi says Tehran is not in direct US talks and wants compensation to reopen the waterway; Trump called the negotiations 'semi-negotiating,' citing Iran's economic strain (CNBC, Aug 10). No signed reopening is confirmed. Brent is $84.35, WTI $78.74 and TTF 56.34 EUR/MWh on Aug 10. Crisis level remains 4 (High); tail raised to 33% while base falls to 12%.) |
| **Brent** | $84.35 (2026-08-10, Trading Economics; +1.0%) |
| **JKM** | $22.00/MMBtu (Jul 24, Reuters Sept-delivery assessment, carried; CFD reference $21.12/MMBtu, Trading Economics, Aug 7; Qatar force majeure carried to mid-September, further extension to mid-October reportedly in preparation) |
| **TTF** | 56.34 EUR/MWh (2026-08-10, Trading Economics; +1.4%) |
| **Exposure trace** | Middle East Eye (Aug 8, citing Kpler) reports just 8 confirmed Hormuz crossings on Aug 7, down 33% day-on-day, with most vessels routed via Iran's Unilateral Scheme; Bab el-Mandeb crossings rose 18% to 26. Iran's Supreme National Security Council set new conditions to reopen Hormuz on Aug 8 - lifting the US naval blockade and sanctions, withdrawing US forces, paying war reparations and releasing frozen Iranian assets (CNN, Aug 8). The same day ADNOC confirmed a missile struck one of its vessels transiting Hormuz; 15 ADNOC vessels have been targeted since Feb 28, three this week alone, killing one crew member and injuring 20 (Al Jazeera, Aug 8). Qatar force majeure remains carried through mid-September, current route-normalised freight and war-risk costs remain unavailable, and no signed reopening is confirmed. |
| **Evidence audit** | 15 checked · 13 verified · 2 carried · 0 unsupported · PASS |
| **Commercial evaluation** | Qatar supply disruption: partial (insufficient verified data); Hormuz delivery constraint: partial (insufficient verified data); Hormuz crude-export constraint: partial (insufficient verified data) |

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
| `src/data/exposure-traces.json` | Signal to Exposure, globe routes, Counterparties, Actions, Evidence | Daily inputs; event and contract changes as triggered |
| `src/data/evidence-audit.json` | Reviewed evidence-validation gate | Every daily run; recrawl changed or due sources |
| `src/data/iran-intel-events.json` | Right panel - Events | Daily |

### Runtime Data Source — READ BEFORE EDITING (critical)

**The running app fetches every JSON dataset from `public/data/*.json` at runtime (`useStaticJson`), not from `src/data/`.** `bun run daily:apply` auto-mirrors `daily-state.json`, `exposure-traces.json`, `iran-intel-events.json`, `banker-cross-asset.json`, `banker-conflict.json`, `charts-volatility.json`, and `commodities-impact.json`. `bun run daily:check` rejects drift for all seven.

The remaining archive datasets are manually mirrored:

```bash
cp src/data/banker-trade-ideas.json public/data/banker-trade-ideas.json
cp src/data/banker-sanctions.json public/data/banker-sanctions.json
cp src/data/banker-clients.json public/data/banker-clients.json
```

Always diff `src/data/` vs `public/data/` for the three manually mirrored archive files as part of E2E verification.

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

5. **Before committing**: Run `bun run daily:evidence`. Every confirmed exposure or commercial metric must have directly supporting audited evidence. Assumed or estimated inputs are rejected from the published trace dataset.

### Reviewed Evidence Gate

The live Firecrawl step happens before publishing. Its reviewed output is stored in `src/data/evidence-audit.json`; `daily:update` never recrawls after approval.

For every due or changed evidence URL:

1. Scrape the exact article, release, PDF, official-data page, or market-data page. Category and landing pages are not accepted.
2. Record the final canonical URL, HTTP status, page type, title, publisher, publication date, retrieval time, claim summary, and extracted facts.
3. Map the evidence explicitly to every supported trace hop, confirmed metric, commercial input, derived metric, and counterparty relationship.
4. For a market observation, record its exact value, unit, instrument, provider, source date, and observation timestamp when available.
5. Set `contentStatus` to `verified`, `unsupported`, `stale`, `unreachable`, or `manual-review`, then record the analyst decision in `reviewStatus`.
6. Run `bun run daily:evidence`; resolve every failure before `daily:apply`.

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

**Switching an evidence source (e.g. Yahoo Finance to Trading Economics) requires a pre-sync step.** `bun run daily:evidence` (and the gate inside `daily:apply`) validates `evidence-audit.json` against the **currently committed** `src/data/exposure-traces.json` `evidence[]` array, not the post-apply one — `daily:apply` only regenerates `evidence[]` *after* the gate passes. So when a source's `url`/`publisher`/`publishedAt` changes, hand-edit `src/data/exposure-traces.json`'s `evidence[]` entry to match the new evidence-audit entry (and the `traceInputs.evidenceUpdates` block in `daily-state.json`) *before* running `daily:evidence`, otherwise it fails on url/publisher/publishedAt/checkedAt mismatches even though the values are internally consistent everywhere else.

**`reviewedAt` and each entry's `checkedAt` must be at or before the real wall clock** (`Date.now() + 5min`), not a rounded-up placeholder — this demo's system clock tracks the in-story date, so a timestamp like `T05:00:00Z` written before checking the actual current time can land in the future and fail with "reviewedAt cannot be in the future." Run `date -u` first and pick a timestamp a few minutes behind it.

### Confirmed Source Map (daily update)

| Asset | Primary Source | Tickers / Access |
|-------|---------------|-----------------|
| Brent crude | Qatar News Agency, Reuters, EIA | Bloomberg `CO1 Comdty`; TradingView `UKOIL` |
| WTI crude | Qatar News Agency, Reuters, EIA | Bloomberg `CL1 Comdty`; TradingView `USOIL`; FRED |
| Dubai/Oman crude | Exact dated Platts, Argus, DME, Reuters or approved equivalent | Manual until a dependable feed is approved |
| TTF Gas | Yahoo Finance machine refresh; ICE or Trading Economics analyst cross-check | Yahoo `TTF=F`; Bloomberg `TTFMBASE Index`; ICE TTF front-month |
| JKM LNG | Reuters (Platts assessment), globallnghub.com | Bloomberg `JKMNEDAN Index`; CME JKM futures |
| EUR/USD | Yahoo Finance machine refresh; ECB cross-check | Yahoo `EURUSD=X`; ECB reference rates |
| SOFR | Federal Reserve Bank of New York API | `markets.newyorkfed.org` |
| LNG/VLCC freight | Exact dated Baltic, Argus, Reuters or approved route assessment | Must state route, cargo/vessel size, unit and date |
| EM FX (SGD, IDR, MYR, THB, PHP) | Reuters, Bloomberg FX | xe.com (directional only) |
| EM Rates | Bloomberg sovereign pages, Investing.com | Tickers: `GIDN10YR`, `GPHL10YR`, `GTHA10YR` |
| iTraxx Asia ex-Japan IG | Bloomberg, Markit | Bloomberg `ITRXAXIG5Y Index` |
| ASEAN HY | BAML ASEAN HY indices, JPMorgan CEMBI | Bloomberg CEMBI |
| Equity Sectors | MSCI ASEAN, SGX | MSCI ASEAN Energy, SGX shipping sub-index, MSCI ASEAN Banks |
| OVX | CBOE CDN (`OVX_History.csv`) — fetched live on page load | charts-volatility.json fallback |
| VXEEM | CBOE CDN (`VXEEM_History.csv`) — fetched live on page load | charts-volatility.json fallback |
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

### Three-trace review

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

## 2. Cross-Asset Data (`banker-cross-asset.json`)

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

### Categories to Update Daily

1. **Energy** — Brent, TTF Gas, JKM LNG
2. **EM Rates** — Indonesia 10Y, Philippines 10Y, Thailand 10Y
3. **Credit Spreads** — iTraxx Asia ex-Japan IG (bp), ASEAN HY Composite (bp) *(cross-asset panel only; bottom chart uses live VXEEM)*
4. **EM FX** — USD/SGD, USD/IDR, USD/MYR, USD/THB, USD/PHP
5. **Equity Sectors** — ASEAN Energy Equities (idx), Regional Shipping (idx), ASEAN Banks (idx)

---

## 2. Market Fallback Quotes (`src/hooks/useMarkets.ts`)

Update the `FALLBACK_QUOTES` array near the top of the file:

```typescript
// Static fallback — reflects intel report baseline (YYYY-MM-DD)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 80.2,   change: 8.2,  changePct: 11.4, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-03T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 76.9,   change: 7.6,  changePct: 11.0, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-03T00:00:00Z" },
];
```

- `change` = absolute price move from prior close
- `changePct` = percentage move (positive = up)
- `lastUpdated` = today's date at `T00:00:00Z`

---

## 2.5 MarketsWidget Red Alert (`src/components/MarketsWidget.tsx`)

The expanded Red Alert is controlled by one constant and must be updated alongside cross-asset data:

```typescript
const TOP_ALERT = "..."; // rolling news alert; rewrite with today's top event
```

The alert is always rendered in full. Replace it daily with the single most market-significant event; keep it concise enough for the market panel.

---

## 3. Client Roster (`banker-clients.json`)

Fields: `id` (permanent lowercase slug), `name`, `sector` (specific, e.g. `"Upstream Oil & Gas"`), `country` (HQ), `exposure` (4 scores), `scenarioImpacts` (base/stress/tail), `talkingPoints` (3, each starting with a data point).

**Exposure scores 1-10**: `energyCosts` (1-3 = producer benefits from spike; 7-10 = major importer, energy >20% cost base) | `shipping` (1-3 = no fleet; 7-10 = large owned/chartered fleet, route-dependent) | `sanctions` (1-3 = no Iran/Russia exposure; 7-10 = direct designation risk) | `refinancing` (1-3 = strong balance sheet; 7-10 = high leverage, near-term maturity)

*Rare ops (adding/removing clients): follow schema in the actual file; keep `cfTriggers` in sync.*

---

## 4. Conflict Status (`banker-conflict.json`)

**Escalation levels 1-5**: Normal (no escalation) → Elevated (diplomatic tension) → Heightened (military positioning + sanctions) → High (active strikes/closures, material market impact) → Severe (full theatre conflict, systemic disruption)

### `todaysEvents` Convention

- Replace all 3 events each day (do not accumulate)
- Each event `summary` is the short Market Brief signal title: <=8 words or about 45 characters, no dates or source names
- Put the detail, evidence, source/date context, and market implication in `delta`
- `direction`: `"up"` = escalation, `"down"` = de-escalation, `"neutral"` = lateral development
- `deltaVsYesterday`: tracks the **escalation `level` number only** (+1 if level rose vs yesterday, 0 if level unchanged, -1 if level fell). Do not derive it from scenario-probability or tail-% movement — those can shift day to day while the level itself stays flat. Once level is capped at 5 (Severe, the max), `deltaVsYesterday` stays 0 every day the level remains 5, however sharply Base/Stress/Tail move; only a change in the `level` field itself (which requires escalation beyond Severe or de-escalation to Level 4) produces a nonzero value.

### Scenario Probability Rules

- Base + Stress + Tail must sum to **100**
- As escalation increases: shift probability from Base → Stress/Tail
- As de-escalation occurs: shift Stress/Tail → Base

---

## 5. Trade Ideas (`banker-trade-ideas.json`)

### Daily Update Process

1. Update price references in `rationale` to match current cross-asset data
2. Change date references (`Mar 2` → `Mar 3`) where specific dates appear
3. Update `cfTriggers` client names if client roster changes (must match `name` field in `banker-clients.json`)
4. Adjust `conviction` level if scenario probability shifts materially
5. Do **not** change `id` fields — these are stable identifiers

**cfTrigger urgency**: `critical` ≤72h window | `high` ≤2 weeks | `medium` no immediate pressure | `low` monitor only

---

## 6. Sanctions Tracker (`banker-sanctions.json`)

### When to Update

- **New OFAC/EU/UN designation**: Add new entry at top of `sanctionsEntries` array with new `id` (s0, s1…), increment existing IDs
- **Status change**: Update `"status"` from `"pending"` to `"active"` when confirmed
- **Date references in descriptions**: Update `s0` description to reflect latest developments (e.g., MAS actions, SGX suspensions)
- **Do not remove entries** — sanctions are historical record; only add or update status

### Adding a New Sanctions Entry

```json
{
  "id": "s0",
  "date": "2026-03-03",
  "authority": "OFAC | EU | UN | US State Dept | FinCEN | MAS",
  "description": "Detailed description of the designation/action...",
  "status": "active | pending",
  "affectedEntities": ["Entity 1", "Entity 2"]
}
```

---

## 7. Supply Chain Impact (`commodities-impact.json`)

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

### Trade Ideas (`banker-trade-ideas.json`)

**When to retire a trade idea:**
- The position has been closed or stop-loss hit
- The underlying thesis has fundamentally reversed (e.g., Hormuz fully reopens)
- Conviction drops to `low` AND the scenario driving it falls below 20% probability

**When to update (not retire):**
- Conviction changes from `high` → `medium` or vice versa: update field only; keep rationale
- Price targets shift materially: update rationale price references; do not add a new entry

**Do not create a new trade idea** for an update to an existing theme — edit the existing entry's `rationale` instead.

### Runbook Self-Maintenance

- **Crisis timeline archive** (`docs/crisis-timeline-archive.md`): Add each new day's headline event on the day it occurs. Remove day entries only if they contain factually incorrect information (see Source Validation Policy).
- **Price Narratives section**: Update Brent, JKM, TTF, and credit baseline narrative **daily** when updating cross-asset data. Keep it synchronized with `banker-cross-asset.json`.

---

## Daily Update Checklist

### Morning Update (Pre-Market Open, ~08:00 SGT)

- [ ] **Preview without mutation**: Run `bun run daily:fetch -- --dry-run`; verify Brent, WTI, and `TTF=F` results. Confirm `git diff -- src/data/daily-state.json` shows no change from this command.
- [ ] **Persist machine refresh**: Run `bun run daily:refresh`. This writes successful liquid values to daily state only; it does not publish.
- [ ] **Firecrawl evidence review**: Scrape every changed or due evidence URL and update `src/data/evidence-audit.json` with the reviewed content result and claim mappings.
- [ ] **Evidence gate**: Run `bun run daily:evidence`. Do not continue with unsupported, unreachable, pending, rejected, landing-page, or observation-mismatch failures.
- [ ] **Complete analyst inputs**: Review JKM, Qatar output/force majeure, Hormuz condition and AIS count, LNG freight/delay ranges, evidence updates, and the trace headline. Carry unavailable observations with original dates and reasons.
- [ ] **Review three traces**: Read every five-hop chain, confirmed/carried/unavailable metric, named public relationship, and portfolio action before publishing.
- [ ] **Source check first**: For each price you plan to enter, confirm a named source exists (see Source Validation Policy above). Do not enter a number if the only answer to "where did this come from?" is "I estimated it" — use last confirmed level instead and note the date.
- [ ] **Cross-asset**: Update `asOf` date, refresh all `current` prices and `change1d` values
- [ ] **useMarkets.ts**: Update `FALLBACK_QUOTES` prices, changes, and `lastUpdated` dates
- [ ] **MarketsWidget.tsx**: Update the expanded `TOP_ALERT` with the single most market-significant event
- [ ] **Conflict**: Replace `todaysEvents` with 3 new events; update `deltaVsYesterday`; verify scenario probabilities sum to 100
- [ ] **Trade ideas**: Update date references (e.g., "Mar N"); refresh price citations in rationale
- [ ] **Intel events — refresh prices**: In `iran-intel-events.json`, update stale Brent/JKM/TTF price references in `energy-003`, `trade-001`, `trade-003`, and any event citing a specific price level
- [ ] **Intel events — rewrite daily entries**: Rewrite (do not prepend) `ship-001`, `sec-005`, `supply-001` descriptions with today's data. Max 150 words each. Remove any "Day N update:" prefix.
- [ ] **Intel events — title hygiene**: Replace `sec-005` title with today's single top security event (≤8 words); do not accumulate prior event names in the title
- [ ] **Intel events — retirement check**: Flag any event with probability <15% or a resolved thesis; confirm before deleting
- [ ] **Trade ideas — retirement check**: Remove any idea whose stop-loss was hit or thesis has reversed; do not archive, just delete
- [ ] **Supply chain commodities**: In `src/data/commodities-impact.json`, update `asOf`, `current`, `change1d`, and recalculate `zscore`/`signal` for all 14 assets. Update `narrative` only if the supply chain mechanism has materially changed. Update `scenario` field if the primary disruption vector has shifted.
- [ ] **BottomChartsPanel — Scenarios only**: In `src/data/charts-volatility.json`, append one entry to `days` with the new `scenarios` array (must sum to 100 and match `banker-conflict.json`). **OVX and VXEEM are fetched live from CBOE on page load — no manual update needed.**
- [ ] **BottomChartsPanel — rolling window check**: No script gates this, so check it manually every run: `python3 -c "import json;d=json.load(open('src/data/charts-volatility.json'));print(len(d['days']),d['days'][0]['day'],d['days'][-1]['day'])"`. If the array exceeds ~12 entries, trim to the latest ~10 (oldest first), then re-run `bun run daily:apply` to re-mirror. It grew unbounded from D107 to D159 (28 entries) before being caught on the Aug 10 update — don't rely on memory to catch this.
- [ ] **Runbook Price Narratives**: Update Brent, JKM, TTF, credit baseline lines to match today's cross-asset data
- [ ] **Crisis timeline archive**: Append today's headline in `docs/crisis-timeline-archive.md`; keep entries to ≤25 words each
- [ ] **Sanctions**: Check for overnight OFAC/EU announcements; update `s0` description if MAS/SGX actions occurred
- [ ] **Validate JSON**: Run `node -e "JSON.parse(require('fs').readFileSync('./src/data/<file>.json','utf8'))"` for each modified file — including `commodities-impact.json`
- [ ] **Apply and validate reviewed state**: Run `bun run daily:apply -- --dry-run`, inspect the file list, then run `bun run daily:update`. This command must not refetch or recrawl.
- [ ] **Sync manually-mirrored archive files to `public/data/`**: If you edited `banker-trade-ideas.json`, `banker-sanctions.json`, or `banker-clients.json`, copy each to `public/data/` - see "Runtime Data Source" above.
- [ ] **Build check**: Run `bun run build` — verify TypeScript compiles with no errors

### Weekly Review

- [ ] **Client talking points**: Refresh to reflect current week's market levels
- [ ] **Scenario probabilities**: Recalibrate Base/Stress/Tail based on geopolitical trajectory
- [ ] **Baseline30d**: Update rolling 30-day averages in cross-asset
- [ ] **cfTriggers**: Review urgency levels — escalate or de-escalate as market windows shift

### Client Roster Change (Ad Hoc)

- [ ] Update `banker-clients.json` — new client with full schema
- [ ] Update `cfTriggers` in `banker-trade-ideas.json` if client is a CF target
- [ ] Verify client `id` slug matches `cfTrigger.client` display name convention (name field, not id slug)

---

## E2E Verification Recipe

1. `bun run dev` → open `http://localhost:5173`
2. Open **SIGNAL → EXPOSURE**, switch all three traces, and verify the five-hop chain, verified-data statuses, evidence, commercial evaluation, and portfolio action update together
3. Close the overlay and verify the globe shows only the selected trace route, with LNG production/carrier/terminal/demand nodes and no stale route from the previous selection
4. Open **Counterparties**, **Actions**, and **Evidence**; copy the decision brief and confirm named relationships and evidence resolve correctly
5. Right panel — **EVENTS**: intel events visible, no `pm-` events, filters work
6. Right panel — **SUPPLY CHAIN**: all 4 categories present; `asOf` matches today; asset rows expand
7. Browser console — no errors
8. Ticker bar — fallback prices match `useMarkets.ts`
9. Verify at 1280×720 and 1440×900; no clipped chain cards, tabs, or action controls
10. `diff src/data/exposure-traces.json public/data/exposure-traces.json` must be empty
11. If manually mirrored files were edited, their source/runtime diffs must also be empty
12. `bun run daily:evidence` must report zero unsupported and zero pending evidence

---

## Narrative Conventions (Iran Escalation Scenario)

### Archived Crisis Log

The permanent day-by-day crisis history lives in `docs/crisis-timeline-archive.md`. Daily updates append one line to that archive only; this runbook should keep current-state and schema guidance, not the full historical log.

### Price Narratives (update daily — keep synchronized with `banker-cross-asset.json`)

> **Update this section every morning** alongside cross-asset data. Replace the prior-day levels; do not accumulate historical milestones beyond the 3 most significant inflection points.

- **Brent**: Pre-shock ~$65 -> $126 wartime high intraday (Day 59, Apr 30, CNBC/CNN) -> $98.57 (Jun 3 D93 peak) -> $78.88 (Aug 4, -5.8%, Trading Economics) as reopening hopes grew -> $83.46 (Aug 7, Yahoo Finance BZ=F) as Hormuz traffic stayed depressed -> $84.35 (Aug 10, +1.0%, Trading Economics) as Iran set new Aug 8 conditions to reopen Hormuz (naval blockade lift, sanctions end, troop withdrawal, reparations, frozen-asset release) and an ADNOC vessel was struck by missile the same day. Working range $75-85 base (signed workable deal); $78-95 stress (conditional routing); $105-135+ tail (renewed closure).
- **JKM LNG**: Baseline $9.5 -> $23.40/MMBtu (Day 20, Reuters/Platts) -> $22.00/MMBtu (Jul 24, Reuters September-delivery assessment) as sustained Hormuz disruption tightened Asian LNG balances; carried at $22.00 pending a newer weekly assessment. Contextual CFD reference $21.12/MMBtu (Trading Economics, Aug 7, -0.12%). Qatar force majeure is carried through mid-September from the Reuters Jul 23 notice; the reported mid-October extension remains unconfirmed.
- **TTF Gas**: Pre-shock ~$34/MWh -> 63.58/MWh (Jul 24, +2.71% vs Jul 23, MacroMicro) -> 55.51 EUR/MWh (Aug 7, Yahoo Finance TTF=F) as Hormuz traffic stayed depressed -> 56.34 EUR/MWh (Aug 10, +1.4%, Trading Economics) as Iran hardened its Hormuz reopening demands. The marker remains elevated versus the pre-crisis baseline while Qatar LNG force majeure and constrained Hormuz traffic persist.
- **Credit**: iTraxx Asia IG est. ~138bp (Aug 5, -2bp); ASEAN HY est. ~475bp (-8bp), both carried pending fresher EM credit data. The scenario split is now base 12%, stress 55%, tail 33% because Iran set steep Aug 8 conditions to reopen Hormuz and ADNOC reported a third vessel attack this week with casualties; no signed reopening is confirmed.

### BottomChartsPanel — Daily Update (`src/data/charts-volatility.json`)

**OVX and VXEEM are fetched live from CBOE CDN on page load** — no manual update needed for these.

Only the `scenarios` array requires a manual daily entry. Append one object to the `days` array:

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
- Set `ovx` / `vxeem` to the previous day's close as a fallback (used if CBOE fetch fails); set `Confirmed: false` so the dashed line renders correctly until live data loads.
- Update `DAYS` label (`D11`, `D12`, …) in lockstep.
- The peak annotation (`▼ -N from peak`) auto-calculates — no manual edit needed.
