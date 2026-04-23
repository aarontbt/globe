# Market Brief Update Guide

**Purpose**: Reference manual for the ASEAN maritime intelligence globe demo. All data is in static JSON files in `src/data/`. No API layer — changes take effect immediately on `bun run dev`.

> **Daily execution**: Load `docs/daily-agent-prompt.md` instead — it is the lean, token-efficient daily prompt. This file is the reference manual for schemas, conventions, and rare operations.

## Current State

| Field | Value |
|-------|-------|
| **Last updated** | 2026-04-23 (Day 52) |
| **Crisis level** | 4 — High (IRGC seizes MSC Francesca + Epaminondas in Hormuz Apr 22, hours after ceasefire extension; Iran: 'extension has no meaning'; Malaysia Petronas net fuel importer confirmed; June supply uncertain; tail risk 40%) |
| **Brent** | ~$102.50 (D52, Apr 23, est.; last confirmed $101.73 TradingEconomics/Fortune Apr 22) |
| **JKM** | ~$17.00/MMBtu (D52, Apr 23, est.; last confirmed $15.81 TradingEconomics Apr 21) |
| **TTF** | ~€43.50/MWh (D52, Apr 23, est.; last confirmed €42.39 OilPriceAPI Apr 22) |

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
| `todaysEvents` `summary` | **25 words** | One sentence per event, no sub-bullets. |
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
- Each event `summary` should include the date `(Mar N)` at the end
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

- **Crisis Timeline section** (bottom of this file): Add each new day's headline event on the day it occurs. Remove day entries only if they contain factually incorrect information (see Source Validation Policy).
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
- [ ] **Runbook Crisis Timeline**: Append today's headline in one line; keep entries to ≤25 words each
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

### Crisis Timeline

- **Day 0**: Feb 28, 2026 — US-Israeli strikes on Iran (Operation Epic Fury / Roaring Lion); Khamenei killed; IRGC assumes command
- **Day 1**: Mar 1 — Hormuz declared de facto war zone; IRGC broadcasts "no ship allowed to pass" on VHF; tanker Skylight struck near Khasab; transit collapsed ~70%
- **Day 2**: Mar 2 — Second tanker hit by drone boat; QatarEnergy halts LNG at Ras Laffan after drone attacks; ASEAN diplomatic responses; Philippines DOE warning; Malaysia tables parliamentary condemnation
- **Day 3**: Mar 3 — Oman back-channel rejected; MAS emergency guidance issued; Saudi/UAE spare capacity activation signalled; ASEAN FM statement ("serious concern" — no condemnation)
- **Day 4**: Mar 4 — Trump announces naval escort program and sovereign war risk guarantee; OPEC+ emergency response disappoints (only +206k bpd); Iran Assembly of Experts convenes in Qom for successor vote; Brent peaks $83.50; all 12 IG P&I clubs confirm midnight March 5 exit
- **Day 5**: Mar 5 — Full P&I insurance blackout IN EFFECT; AIS shows transits at ~28/day (80% drop from 138/day historical avg); 3rd tanker struck off Oman (set ablaze); US Navy escort confirmed NOT operational (navy lacks capacity per SSY/Argus); Mojtaba Khamenei succession vote expected; Philippines formally rejects EDCA-base link to Middle East operations
- **Day 6**: Mar 6 — US submarine sank Iranian frigate Iris Dena off Sri Lanka (Indian Ocean expansion); IRGC threatens Strait of Malacca closure; Iraq cuts output ~1.5M bbl/day (Kuwait/UAE may follow, 3M+ bpd at risk); Congress rejects war powers resolution; Hegseth: "accelerating"; Qatar FM first direct contact with Iranian FM (sole de-escalation signal); Brent $85.60 (+3.0%); 329 tankers trapped in Gulf; escalation level raised to 5
- **Day 7**: Mar 7 — IAF strikes 400+ targets including Mehrabad Airport and Tehran fuel depots; oil posts biggest weekly gain in futures trading history (CNBC); Brent approaches $90+
- **Day 8**: Mar 8 — Mojtaba Khamenei elected Supreme Leader; Iranian FM rejects ceasefire; Iraq output -60% (Bloomberg); Kuwait cuts begin; Saudi Arabia struck; JP Morgan: 4.7M bpd GCC shut-in within 2 weeks; Brent ~$104
- **Day 9**: Mar 9 — Brent $106.40 (+63% from pre-shock); Qatar loads first LNG cargo since force majeure but full restart contingent on war end; no ceasefire signal; GCC supply collapse accelerating
- **Day 10**: Mar 10 — Kuwait confirms full output suspension; GCC deficit 5.2M bpd; IRGC seizes VLCC Pacific Gallant (28 crew held); UN ceasefire veto (Russia/China); Brent $109.80
- **Day 11**: Mar 11 — Explosive boats hit two Iraqi fuel-oil tankers near al-Faw; IEA approves 400M-barrel release; US pledges 172M SPR barrels; Brent settles near $92
- **Day 12**: Mar 12 — Basra disruption renews supply shock; Brent rebounds to ~$100 despite reserve release; ASEAN oil-importer FX weakens again
- **Day 13**: Mar 13 — Khamenei vows Hormuz closure permanent; 6 vessels struck (Mar 12) incl. Thai tanker; Pezeshkian sets ceasefire terms (US recognition + reparations); Brent $100.84
- **Day 14**: Mar 14 — First zero-AIS traffic day on Hormuz; Trump announces warship coalition (China, France, Japan, S. Korea, UK); India secures bilateral tanker passage; Fujairah loading briefly halted by drone debris fire; US Treasury GL 134 authorises ~215M barrels Russian crude on ~377 loaded tankers
- **Day 15**: Mar 15 — Iran FM Araghchi: "We never asked for a ceasefire"; Hormuz "open to international shipping, only US/Israeli vessels barred"; IRGC 50th operational wave strikes US bases in UAE, Bahrain, Kuwait; allied response to coalition muted; Japan: involvement "impractical"
- **Day 16**: Mar 16 — Dubai Airport drone strike suspends Emirates flights; UAE hit by 6 ballistic missiles + 21 drones; Fujairah oil facility fire; single Aframax tanker transits Hormuz (bilateral deal); Iran cyberattack on US Stryker medical; no coalition materialises; Brent $104.73
- **Day 17**: Mar 17 — Israel kills IRGC security chief Larijani and Basij commander Soleimani; Mojtaba Khamenei status disputed (Trump: "may not be alive"); EU, Germany, Australia refuse coalition; Brent $102.92 (-1.7%); JKM confirmed $19.27/MMBtu (+19% from prior)
- **Day 18**: Mar 18 — Iran retaliates for Larijani killing; 2 killed in Israel; Trump defiant on Hormuz coalition ("don't need it"); Joe Kent (counterterrorism chief) resigns over Iran war; Brent $102.52 (-0.9%)
- **Day 19**: Mar 19 — Israel strikes South Pars gasfield; Iran attacks Qatar LNG hub + Saudi Red Sea refinery; Saudi warns "military actions if necessary"; European gas +35%; Brent $112.80 (+10%)
- **Day 20**: Mar 20 — Saudi Arabia launches airstrikes on IRGC naval facilities at Bandar Abbas — first direct Saudi military action against Iran; JKM new Platts $23.40; Brent $121.40 (+7.6%)
- **Day 21**: Mar 21 — Weekend; Arab League emergency summit called for Cairo; Iran vows response against Saudi oil fields; China urges maximum restraint; Brent carries Day 20 close
- **Day 22**: Mar 22 — Iran launches 15 missiles toward Abqaiq; Saudi Patriot intercepts 12; 3 strike perimeter (no production impact per Aramco); Arab League emergency summit in Cairo; tail risk 40%
- **Day 23**: Mar 23 — Trump 5-day pause on Iran power plant strikes; Brent -17% to ~$100.84; Iran denies talks; IRGC hits US 5th Fleet Bahrain + Prince Sultan airbase; unprecedented Israel-US strikes on Iran
- **Day 24**: Mar 24 — Iran FM privately confirms US mediator message (CBS News); Brent $96.50 Asia/$103 US volatile; ~2,000 vessels trapped (IMO); Mar 28 deadline; tail risk 32%
- **Day 25**: Mar 25 — US 15-point peace plan to Iran via Pakistan; Iran opens Hormuz to non-hostile vessels; Israel new wave of Tehran + first Caspian strikes; Brent -6% to ~$98.30; tail risk 30%
- **Day 26**: Mar 26 — Iran rejects US plan; 5 counter-conditions incl. Hormuz sovereignty; Lebanon front re-activated; Brent rebounds ~$101; Pakistan offers talks; tail risk 33%
- **Day 27**: Mar 27 — Iran activates Hormuz 'Tehran Toll Booth'; $2M/vessel in yuan; Trump extends to Apr 6; Brent $112.57 confirmed; tail risk 36%
- **Day 28**: Mar 28 — Houthis fire first missile at Israel from Yemen (intercepted); new front opened; IDF widespread Tehran strikes; US soldiers injured in Saudi base attack; tail risk 41%
- **Day 29**: Mar 29 — Iran waiting for ground invasion; US reinforces Middle East; Islamabad FM summit (Pakistan, Turkey, Egypt, Saudi) seeks de-escalation; Brent $112.57 carried
- **Day 30**: Mar 30 — Iran drone strikes Kuwait power & desalination plant; Indian worker killed; Trump mulls Kharg Island seizure; Tehran power grid hit; Brent $115.93 (+3.0%)
- **Day 31**: Apr 1 — Trump 'leaving in 2-3 weeks'; Brent -13% to $100.64 (Reuters); Iran fires 7 missiles at Israel; IRGC threatens 18 US tech firms
- **Day 32**: Apr 2 — Trump 'Stone Ages' escalation reverses Day 31; Iran hits UAE with 457 missiles + 2,038 drones (11 dead); Brent +8.3% to $109; Philippines bilateral Hormuz deal
- **Day 33**: Apr 3 — Brent $109.03 confirmed (Gulf News/CNBC); WTI ~$111; April 6 deadline 3 days; Iran FM 'trust level zero'; tail risk 50%
- **Day 34**: Apr 4 — US F-15E shot down over Iran (first US aircraft lost); 1st crew rescued same day; A-10 Warthog also hit near Hormuz; Trump issues 48-hr ultimatum
- **Day 35**: Apr 5 — 2nd F-15E crew rescued ('Easter miracle' - Trump); Kuwait desalination offline; 90% water at risk; Trump threatens power plants + bridges by Apr 6
- **Day 36**: Apr 6 — April 6 8pm ET deadline active; Brent ~$110.50 est. (+1.4%); WTI $111.81 (OilPriceAPI); AIS transits -95%; Iran refuses; iTraxx ~195bp est.; tail risk 54%
- **Day 37**: Apr 7 — 15 US soldiers injured Kuwait; IDF hits Asaluyeh petrochemical complex + kills IRGC intel chief Khademi; IRGC blocks 2 Qatari LNG tankers; WTI $113 confirmed; tail risk 56%
- **Day 38**: Apr 8 — Apr 7 deadline passes into limited US-Israel grid/bridge strikes; Tehran Toll Booth stays active; AIS transits -95%; Brent ~$118.20; tail risk 60%
- **Day 39**: Apr 9 — Trump announces conditional 2-week US-Iran ceasefire; Brent crashes -18% to ~$97; Iran claims Hormuz still closed (Israeli Lebanon strikes: 254 dead); tail risk 30%
- **Day 40**: Apr 10 — Brent $95.20 (-0.75%, TradingEconomics); Hormuz ~4 transits (S&P Global); ADNOC CEO: strait not open despite ceasefire; Trump: Iran "dishonorable"; delegations fly to Islamabad; tail risk 32%
- **Day 41**: Apr 11 — USS Frank E Peterson + USS Michael Murphy transit Hormuz (first US warships since Feb 28, CBS News/Al Jazeera); Iran: "last warning"; 3 supertankers follow (Fortune); Vance-Iran Pakistan talks begin; tail risk 35%
- **Day 42**: Apr 12 — Vance-Iran Pakistan talks: NO DEAL after 21 hours (NBC News, CNBC); sticking points: nuclear commitment + Hormuz sovereignty; Iran: "excessive US demands"; talks to continue; tail risk 38%
- **Day 43**: Apr 13 — Trump orders US naval blockade of Hormuz (NBC, CNN, CNBC); Iran: "strait will not open"; IRGC warns 'regretful response'; Brent +7% to ~$102; tail risk 48%
- **Day 44**: Apr 14 — Blockade takes effect 14:00 GMT; Pentagon: no ships 'made it past' (6 Iran-bound turned around, Al Jazeera); 3 non-Iranian tankers transit Hormuz (LSEG/Kpler); Brent -4.8% to $94.79 confirmed (CNBC); Trump hints fresh Islamabad talks; tail risk 38%
- **Day 45**: Apr 15 — Brent continues lower to ~$93; WTI $90.92 confirmed (TradingEconomics); White House confirms second US-Iran round under discussion; US to let Iran oil waiver expire (Bloomberg); Europe plans postwar Hormuz coalition (Macron/WSJ); tail risk 32%
- **Day 46**: Apr 16 — Iran IRGC threatens Gulf/Red Sea/Gulf of Oman blockade (NBC, Fortune); Pakistan army chief visits Tehran; WH 'very close to deal'; Brent $94.60 confirmed; tail risk 34%
- **Day 47**: Apr 17 — Iran FM Araghchi declares Hormuz 'completely open'; $20B frozen-assets deal under negotiation; Islamabad talks Apr 19 confirmed; Brent $91.87 confirmed TradingEconomics (-2.9%); tail risk 25%
- **Day 48**: Apr 18 — Market closed (Sat); deal negotiations continue; ceasefire expires Apr 22; scenarios carried from D47
- **Day 49**: Apr 20 — Iran re-closes Hormuz, strikes vessels; rejects Islamabad talks (IRNA Apr 19); ceasefire expires Apr 22; Brent ~$96 est. +4.5%; tail risk 42%
- **Day 50**: Apr 21 — USS Spruance seizes Iranian Touska (Gulf of Oman); Iran vows retaliation, suspends talks; ceasefire Apr 22 — extension 'highly unlikely'; Brent ~$99.50 est.; tail risk 50%
- **Day 51**: Apr 22 — Trump extends ceasefire indefinitely at Pakistan request; IRGC seizes MSC Francesca + Epaminondas in Hormuz hours after extension; Brent $101.73 confirmed (+3.3%); tail risk revised to 40%
- **Day 52**: Apr 23 — IRGC ship seizures stand; Malaysia Petronas confirmed net fuel importer; June supply uncertain; RON95 quota cut; Brent ~$102.50 est.; iTraxx ~198bp; tail risk 40%

> **Add each new day's headline here on the day it occurs.** Keep each entry ≤25 words; note the single most market-significant event first.

### Price Narratives (update daily — keep synchronized with `banker-cross-asset.json`)

> **Update this section every morning** alongside cross-asset data. Replace the prior-day levels; do not accumulate historical milestones beyond the 3 most significant inflection points.

- **Brent**: Pre-shock ~$65 → $121.40 (Day 20, +7.6%) → $101.73 (Day 51, Apr 22, confirmed TradingEconomics/Fortune, +3.3% on IRGC ship seizures) → ~$102.50 (Day 52, Apr 23, est.; +0.8%; IRGC holds MSC Francesca + Epaminondas; blockade intact); WTI ~$97.50 est.; working range $95-115 stress; $130-170 tail on ceasefire collapse
- **JKM LNG**: Baseline $9.5 → $23.40/MMBtu (Day 20, Reuters/Platts) → $15.81/MMBtu (Day 50, Apr 21, confirmed TradingEconomics, +3.77%) → ~$17.00/MMBtu (Day 52, Apr 23, est.; +7.5% on ship seizures; blockade and Ras Laffan force majeure intact); Ras Laffan full restart unlikely before late Aug 2026 (The National)
- **TTF Gas**: Pre-shock ~$34/MWh → €49.97/MWh (Day 33) → €42.39/MWh (Day 51, Apr 22, confirmed OilPriceAPI) → ~€43.50/MWh (Day 52, Apr 23, est.; +2.6% on ship seizures; Qatar force majeure persists; Hormuz not reopened)
- **Credit**: iTraxx Asia IG est. ~198bp (Day 52, +8bp on IRGC ship seizures); ASEAN HY est. ~575bp (+15bp); tail scenario targets 230-260bp on ceasefire collapse; tail risk 40%

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
