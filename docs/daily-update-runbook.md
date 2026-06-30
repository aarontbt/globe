# Market Brief Update Guide

**Purpose**: Reference manual for the ASEAN maritime intelligence globe demo. Routine daily updates start in `src/data/daily-state.json`; the generated static JSON/TS files are then refreshed with `bun run daily:apply`.

> **Daily execution**: Load `docs/daily-agent-prompt.md` instead — it is the lean, token-efficient daily prompt. This file is the reference manual for schemas, conventions, and rare operations.

## Current State

| Field | Value |
|-------|-------|
| **Last updated** | 2026-06-30 (D120) |
| **Crisis level** | 2 - Elevated (Jun 30: Iran blocks Oman/UN southern route reopening; attacks Singaporean ship Jun 25; central route mined/closed; Iran insists sole control; IAEA dispute ongoing; France/UK naval taskforce ready; tail 15%) |
| **Brent** | $73.68 (Jun 30, Yahoo Finance; +0.7% from Mon; -27% from D93 $98.57 peak; Goldman Q4 $80 contingent on Hormuz) |
| **JKM** | $18.86/MMBtu (last confirmed Jun 12, TradingEconomics; carried - Ras Laffan restart not before late Aug 2026) |
| **TTF** | €41.54/MWh est. (Jun 26; carried Jun 30; contested Hormuz reopening delays unwinding) |

---

## File Inventory

| File | Panel | Update Frequency |
|------|-------|-----------------|
| `src/data/banker-clients.json` | Client Brief | Per engagement / roster change |
| `src/data/banker-cross-asset.json` | Cross-Asset | Daily (morning) |
| `src/data/banker-conflict.json` | Conflict Status | Daily |
| `src/data/banker-trade-ideas.json` | Trade Ideas | Daily or on major event |
| `src/data/banker-sanctions.json` | Sanctions Tracker | On new designation events |
| `src/data/commodities-impact.json` | Right panel — Supply Chain tab | Daily (key prices); narratives on material supply chain shift |
| `src/hooks/useMarkets.ts` | Ticker bar (fallback quotes) | Daily |
| `src/components/MarketsWidget.tsx` | Ticker alert banner + oil forecast ranges | Daily |
| `src/data/charts-volatility.json` | Bottom volatility charts (OVX, VXEEM, Scenarios) | OVX + VXEEM fetch live from CBOE on load; only Scenarios need manual daily update |

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

5. **Before committing**: Run a mental checklist — for each number entered, ask: *"What is my source for this exact figure?"* If the answer is "I estimated it," that is acceptable for EM data only, and only if directionally validated.

### Confirmed Source Map (daily update)

| Asset | Primary Source | Tickers / Access |
|-------|---------------|-----------------|
| Brent crude | Qatar News Agency, Reuters, EIA | Bloomberg `CO1 Comdty`; TradingView `UKOIL` |
| WTI crude | Qatar News Agency, Reuters, EIA | Bloomberg `CL1 Comdty`; TradingView `USOIL`; FRED |
| TTF Gas | Trading Economics, ICE, Investing.com historical | Bloomberg `TTFMBASE Index`; ICE TTF front-month |
| JKM LNG | Reuters (Platts assessment), globallnghub.com | Bloomberg `JKMNEDAN Index`; CME JKM futures |
| Gold | Trading Economics, MarketWatch | Investing.com |
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
- **No em dashes**: use ` - ` (space-hyphen-space) in all JSON data fields; em dashes cause rendering inconsistencies
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

## 1. Cross-Asset Data (`banker-cross-asset.json`)

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
  { symbol: "GC=F", name: "Gold",        price: 2858.0, change: 13.0, changePct: 0.46, currency: "USD", unit: "/oz",     lastUpdated: "2026-03-03T00:00:00Z" },
];
```

- `change` = absolute dollar/oz move from prior close
- `changePct` = percentage move (positive = up)
- `lastUpdated` = today's date at `T00:00:00Z`

---

## 2.5 MarketsWidget Hardcoded Constants (`src/components/MarketsWidget.tsx`)

Three constants at lines 11–13 must be updated daily alongside cross-asset data:

```typescript
const NEAR_TERM_RANGE = "90-115";   // line 11 — near-term Brent range ($/bbl); update when scenario shifts
const SUSTAINED_PRICE = "160";      // line 12 — tail/sustained disruption level; update when tail scenario changes
const TOP_ALERT = "...";            // line 13 — rolling news banner; rewrite with today's top event ≤25 words
```

| Constant | When to change | Example |
|----------|---------------|---------|
| `TOP_ALERT` | Every day — replace with single most market-significant event | `"APR 12 NO DEAL: Vance-Iran Pakistan talks fail after 21hrs; Hormuz remains conditional; tail risk 38%"` |
| `NEAR_TERM_RANGE` | When stress scenario Brent range shifts materially | `"90-115"` → `"85-105"` on sustained de-escalation |
| `SUSTAINED_PRICE` | When tail scenario changes (Kharg seizure, full GCC collapse) | Raise on tail escalation, lower on ceasefire hold |

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
- `deltaVsYesterday`: +1 (escalated), 0 (flat), -1 (de-escalated)

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

- [ ] **Source check first**: For each price you plan to enter, confirm a named source exists (see Source Validation Policy above). Do not enter a number if the only answer to "where did this come from?" is "I estimated it" — use last confirmed level instead and note the date.
- [ ] **Cross-asset**: Update `asOf` date, refresh all `current` prices and `change1d` values
- [ ] **useMarkets.ts**: Update `FALLBACK_QUOTES` prices, changes, and `lastUpdated` dates
- [ ] **MarketsWidget.tsx**: Update `TOP_ALERT` banner text; adjust `NEAR_TERM_RANGE` and `SUSTAINED_PRICE` if scenario has shifted materially
- [ ] **Conflict**: Replace `todaysEvents` with 3 new events; update `deltaVsYesterday`; verify scenario probabilities sum to 100
- [ ] **Trade ideas**: Update date references (e.g., "Mar N"); refresh price citations in rationale
- [ ] **Intel events — refresh prices**: In `iran-intel-events.json`, update stale Brent/JKM/TTF price references in `energy-003`, `trade-001`, `trade-003`, and any event citing a specific price level
- [ ] **Intel events — rewrite daily entries**: Rewrite (do not prepend) `ship-001`, `sec-005`, `supply-001` descriptions with today's data. Max 150 words each. Remove any "Day N update:" prefix.
- [ ] **Intel events — title hygiene**: Replace `sec-005` title with today's single top security event (≤8 words); do not accumulate prior event names in the title
- [ ] **Intel events — retirement check**: Flag any event with probability <15% or a resolved thesis; confirm before deleting
- [ ] **Trade ideas — retirement check**: Remove any idea whose stop-loss was hit or thesis has reversed; do not archive, just delete
- [ ] **Supply chain commodities**: In `src/data/commodities-impact.json`, update `asOf`, `current`, `change1d`, and recalculate `zscore`/`signal` for all 14 assets. Update `narrative` only if the supply chain mechanism has materially changed. Update `scenario` field if the primary disruption vector has shifted.
- [ ] **BottomChartsPanel — Scenarios only**: In `src/data/charts-volatility.json`, append one entry to `days` with the new `scenarios` array (must sum to 100 and match `banker-conflict.json`). **OVX and VXEEM are fetched live from CBOE on page load — no manual update needed.**
- [ ] **Runbook Price Narratives**: Update Brent, JKM, TTF, credit baseline lines to match today's cross-asset data
- [ ] **Crisis timeline archive**: Append today's headline in `docs/crisis-timeline-archive.md`; keep entries to ≤25 words each
- [ ] **Sanctions**: Check for overnight OFAC/EU announcements; update `s0` description if MAS/SGX actions occurred
- [ ] **Validate JSON**: Run `node -e "JSON.parse(require('fs').readFileSync('./src/data/<file>.json','utf8'))"` for each modified file — including `commodities-impact.json`
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
2. **MARKET BRIEF** overlay: verify `asOf` shows today; Brent price matches; scenario % sums to 100; `cfTriggers` reference correct client names; sanctions entry current
3. Right panel — **EVENTS**: intel events visible, no `pm-` events, filters work
4. Right panel — **SUPPLY CHAIN**: all 4 categories present; `asOf` matches today; asset rows expand
5. Browser console — no errors
6. Ticker bar — fallback prices match `useMarkets.ts`

---

## Narrative Conventions (Iran Escalation Scenario)

### Archived Crisis Log

The permanent day-by-day crisis history lives in `docs/crisis-timeline-archive.md`. Daily updates append one line to that archive only; this runbook should keep current-state and schema guidance, not the full historical log.

### Price Narratives (update daily — keep synchronized with `banker-cross-asset.json`)

> **Update this section every morning** alongside cross-asset data. Replace the prior-day levels; do not accumulate historical milestones beyond the 3 most significant inflection points.

- **Brent**: Pre-shock ~$65 → $126 wartime high intraday (Day 59, Apr 30, CNBC/CNN) → $98.57 (Jun 3 D93 peak; Qeshm strike + Kuwait airport + Rubio rejection) → $75.04 (Jun 25, TradingEconomics) → $71.99 (Jun 26, Hormuz reopening hopes crash, Yahoo Finance) → $73.68 (Jun 30, +0.7% from Mon). Iran blocking all routes it doesn't control — Jun 25 ship attack, IMO abandons Omani route. France/UK naval taskforce ready. Markets pricing normalisation but reopening deeply contested. Goldman Q4 $80 contingent on timeline. Working range $70-85 base; $72-88 stress; $110-130 tail.
- **JKM LNG**: Baseline $9.5 → $23.40/MMBtu (Day 20, Reuters/Platts) → $18.86/MMBtu (last confirmed Jun 12, TradingEconomics; carried). Ras Laffan restart not before late Aug 2026 even on deal; contested Hormuz reopening means elevated prices persist longer than market expects.
- **TTF Gas**: Pre-shock ~$34/MWh → €49.97/MWh (Day 33) → €49.50/MWh (Jun 3 D93 peak) → €41.54/MWh est. (Jun 26; carried Jun 30; contested Hormuz reopening delays crisis premium unwinding)
- **Credit**: iTraxx Asia IG est. ~122bp (Jun 30, -73bp from D93 195bp peak; -6bp from D116 128bp); ASEAN HY est. ~450bp (-130bp from D93 580bp; -10bp from D116 460bp); markets still pricing progressive normalisation but Guardian reporting (Iran blocking routes, ship attack) raises re-escalation risk. Tail 15% (+7pp from D116). Wait for Doha talks outcome before removing further CDS protection.

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
