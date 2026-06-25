# Market Brief Update Guide

**Purpose**: Reference manual for the ASEAN maritime intelligence globe demo. All data is in static JSON files in `src/data/`. No API layer — changes take effect immediately on `bun run dev`.

> **Daily execution**: Load `docs/daily-agent-prompt.md` instead — it is the lean, token-efficient daily prompt. This file is the reference manual for schemas, conventions, and rare operations.

## Current State

| Field | Value |
|-------|-------|
| **Last updated** | 2026-06-26 (Day 116) |
| **Crisis level** | 2 — Elevated (Jun 22-23: roadmap agreed Switzerland; IAEA access disputed; mine-clearing Day 7; tail 8%) |
| **Brent** | $75.04 (Jun 25, TradingEconomics confirmed; +1.76%; -24% from Jun 3 $98.57 peak; Goldman Q4 $80) |
| **JKM** | $18.86/MMBtu (last confirmed Jun 12, TradingEconomics; carried — Ras Laffan restart not before late Aug 2026) |
| **TTF** | €41.54/MWh est. (Jun 26 carried; roadmap de-escalation continued) |

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
- **Day 53**: Apr 24 — Trump orders Navy 'shoot and kill' any Iranian boat mining Hormuz; Brent $105.33 confirmed; WTI $94.40 confirmed; TTF €44.72 confirmed; tail risk 45%
- **Day 54**: Apr 25 — Islamabad talks collapse: Araghchi departs Pakistan; Trump tells Witkoff/Kushner not to travel; no active back-channel; tail risk 50%
- **Day 55**: Apr 26 — Sunday, market closed; Trump 'no time frame' on Iran war; Israel-Lebanon ceasefire extended 3 weeks; ceasefire nominally active but diplomatically contested; tail risk 50%
- **Day 56**: Apr 27 — Araghchi-Putin meeting (St. Petersburg); Iran proposes Hormuz reopening if US lifts blockade + ends war; nuclear deferred; Brent $108.11 confirmed; tail risk 47%
- **Day 57**: Apr 28 — Rubio rejects Iran Hormuz deal (nuclear must be included); Brent confirmed $111.16 (+2.71%, TradingEconomics; market raised risk premium despite rejection); tail risk 45%
- **Day 58**: Apr 29 — Trump declares blockade continues until Iran agrees to nuclear deal; Brent confirmed $118.03 (+6.2%, CNBC; corrected from carried $111.16); tail risk 50%
- **Day 59**: Apr 30 — Brent hits $126 wartime high (CNBC/CNN), closes $114.01; WTI $105.07 confirmed; Trump briefed on expanded military options; tail risk 55%
- **Day 60**: May 1 — Trump declares Iran hostilities 'terminated' to bypass War Powers; Iran proposal rejected ('not satisfied'); Brent $108.10 (-2.1%); tail risk 45%
- **Day 61**: May 2 — Saturday, markets closed; blockade intact; 3 vessels held; standoff continues; tail 45%
- **Day 62**: May 3 — Trump announces 'Project Freedom'; US Navy to guide ships through Hormuz from May 4; Iran warns ceasefire violation; Brent ~$108 carried
- **Day 63**: May 4 — Project Freedom operational; 15,000 US troops, destroyers, 100+ aircraft in Hormuz; Iran reviewing 14-point proposal; Brent $108.12 TradingEconomics morning (US session close $114.4 per CNN, +5.8%); tail 45%
- **Day 64**: May 5 — Trump pauses Project Freedom citing 'Great Progress'; destroyers remain in strait; violence flares in Hormuz; US: ceasefire holds; Brent closed $109.87 (-4%, Fortune); tail 40%
- **Day 65**: May 6 — US/Iran closing in on 14-point MOU: 12-yr nuclear moratorium + Hormuz/blockade framework + 30-day talks (Axios/CNN); Brent crashes -7% to $101.27; markets surge; tail 30%
- **Day 66**: May 7 — US-Iran fire exchange: US sinks 7 Iranian boats; Iran attacks USS Truxtun/Peralta/Mason east of Hormuz; Trump 'love tap'; Brent $100.06 (-1%); tail 35%
- **Day 67**: May 8 — Ceasefire fragile after fire exchange; Iran MOU response via Pakistan within 48hrs; Trump 'very possible' deal; Brent $101.26 (+1.2%, CNBC); WTI $95.64; tail 35%
- **Day 68**: May 9 — Market closed; Iran delays MOU response: "at appropriate time"; US blockade holds; ceasefire intact; scenarios carried from D67.
- **Day 69**: May 10 — Iran delivers counter-proposal via Pakistan; Trump: "unacceptable"/"playing games"; Lebanon-first demand; tail rises 40%.
- **Day 70**: May 11 — OFAC Economic Fury designates ZEUS LOGISTICS/IRGC oil ops; 37+ Iranian tankers trapped in Persian Gulf; blockade 70+ tankers.
- **Day 71**: May 12 — Brent $110.43 confirmed (Fortune); JKM $16.99 confirmed (Canada LNG Group); MOU stalemate; tail 40%.
- **Day 72**: May 13 — Brent $110.87 confirmed (Fortune); IEA: 14M bpd Gulf cut depleting inventories at record pace; WTI ~$102.
- **Day 73**: May 14 — Trump-Xi discuss Hormuz; Brent $105.87 (CNBC confirmed); TTF €47.61 (TE confirmed); Brent -4.5% on diplomacy; tail 38%.
- **Day 74**: May 15 — Brent ~$106 est. (TradingEconomics); MOU stalemate continues; blockade 70+ tankers; IEA record depletion; tail 40%.
- **Day 77**: May 18 — Trump calls off planned Iran strike at Saudi/UAE/Qatar request (CBS News, WashPost); Brent ~$110.69 (-1%, CNBC); tail 37%.
- **Day 79**: May 20 — Trump: Iran talks 'in final stages' (CNBC); WTI breaks below $100; IRGC claims 26 vessels coordinated through Hormuz; PGSA new maritime zone published; tail 34%.
- **Day 80**: May 21 — Iran reviews US proposal; Rubio 'encouraging signs' (CNBC); Brent volatile $104→$107→$103; JKM $18.92 confirmed (Canada LNG Group); tail 34%.
- **Day 81**: May 22 — Khamenei orders uranium to stay in Iran; deal hopes fade; Brent $104.52 (+1.9%, TE confirmed); TTF €47.69 (-3.5% Norwegian surge); tail 38%.
- **Day 82**: May 23 — Trump declares Iran MOU 'largely negotiated' (CNBC, CNN, NPR); 60-day Phase 1 framework: Hormuz opens, Iran oil sales, Phase 2 nuclear 30-60 days; tail 25%.
- **Day 83**: May 24 — Deal details emerge (Axios, CNN); Iran's Fars disputes Strait control; nuclear sequencing unresolved; Brent -7% to ~$96; tail 23%.
- **Day 84**: May 25 — Mixed signals (Al Jazeera); Brent ~$97; WTI briefly below $91; TTF €46.63 (-4.2%, TE); tail 23% held.
- **Day 85**: May 26 — Brent $98.21 (+1.0% TE confirmed); WTI $92.58 (+1.7%); deal 'largely negotiated' narrative holds; tail 23%.
- **Day 86**: May 27 — Rubio 'every chance to succeed'; White House: MOU claim 'fabrication'; fresh US strikes; Brent -5% to $94.29; tail 28%.
- **Day 87**: May 28 — Fresh US strikes; IRGC targets US air base; oil +2% intraday; ceasefire extension reportedly close; tail 28%.
- **Day 88**: May 29 — Brent -19% in May worst since 2020; Trump ends Situation Room no final determination; Fars disputes MOU text; tail 25%.
- **Day 89**: May 30 — Iran reasserts full Hormuz control; vessels need IRGC permission (Al Jazeera); Hegseth US ready to restart war (Shangri-La); Hellfire missile disables ship; tail 27%.
- **Day 90**: May 31 — US warns Iran of strikes if no deal; Lebanon slams Israel scorched earth; deal in limbo; Brent carries $92.05; tail 27%.
- **Day 91**: Jun 1 — Iran suspends peace talks; US hits Iranian radar/drone; Iran targets Kuwait base; oil +4%; Israel-Hezbollah halt agreed; tail 35%.
- **Day 92**: Jun 2 — Talks suspension holds; US-Iran trade blows; Trump insists talks continuing; Brent $94.53; tail 35%.
- **Day 93**: Jun 3 — US strikes Qeshm Island; Iran drone hits Kuwait airport (1 killed); Rubio rejects Hormuz deal; Brent $98.57 (+4.3%); tail 42%.
- **Day 94**: Jun 4 — Aftermath of Qeshm escalation; Brent carries $98.57; tail 42% sustained; no new exchanges.
- **Day 95**: Jun 5 — US shoots down 4 Iranian drones headed toward Hormuz; strikes Iranian coastal radar sites; Iran fires 7 ballistic missiles at Kuwait/Bahrain (6 intercepted); tail 47%.
- **Day 96-97**: Jun 6-7 — Weekend; markets closed; scenarios carried from D95.
- **Day 98**: Jun 8 — Markets reopen post-Jun 5 exchange; tension plateau; tail 47%.
- **Day 99**: Jun 9 — Iran shoots down US Army Apache helicopter over Hormuz; first US aircraft lost in conflict; US issues stern warning; tail 50%.
- **Day 100**: Jun 10 — US retaliates: 49 Tomahawk missiles strike targets within 40 miles of Tehran; largest US strike on Iran since conflict began; tail 50%.
- **Day 101**: Jun 11 — No Iranian response to Tomahawk strikes; Pakistan backchannel accelerating; tail 48%.
- **Day 102**: Jun 12 — Pakistan PM Sharif announces US-Iran 'final agreed text' agreed; Brent falls on deal signal; tail 37%.
- **Day 103**: Jun 13 — Weekend; deal details finalised; signing set Jun 19 Switzerland; scenarios carried from D102.
- **Day 104**: Jun 14 — Trump announces deal (Sunday); US lifts naval blockade immediately; Hormuz to reopen Jun 19 as 'permanently toll free'; Brent -5% to $83.17; tail 20%.
- **Day 105**: Jun 15 — Brent -4.7% to $84.62; Iran 'differing versions' of MOU text; nuclear sequencing unresolved; tail 15%.
- **Day 106**: Jun 16 — Brent $81.55 (Fortune morning); 5th consecutive session lower from D93 peak; iTraxx ~142bp; EM FX broadly stronger; tail 15%.
- **Day 107**: Jun 17 — Brent $79.45 (TradingEconomics, +0.6% minor bounce); WTI $75.47; TTF €41.12; -19% from D93 peak; 2 days to signing; tail 15%.
- **Day 108**: Jun 18 — MOU digitally pre-signed at G7 Versailles (Haaretz); formal ceremony Jun 19 Burgenstock; Brent $79.34 (TradingEconomics, -0.27%); WTI $76.43; TTF €41.33; tail 12%.
- **Day 109**: Jun 19 — MOU formally signed Burgenstock, Switzerland; Phase 2 nuclear talks begin; US markets closed Juneteenth; Brent $79.34 carried; escalation level 2; tail 10%.
- **Day 110**: Jun 20 — Phase 2 nuclear talks in Switzerland abruptly postponed (CNBC); Iran disputes MOU text elements; Brent ~$79.80 est.; tail 11%.
- **Day 111**: Jun 21 — Weekend, market closed; scenarios carried from D110.
- **Day 112**: Jun 22 — US-Iran Phase 2 talks kick off Sunday in Switzerland (Al Jazeera); Vance leads US delegation; Brent ~$79.25 est.
- **Day 113**: Jun 23 — Roadmap agreed: final deal within 60 days (Al Jazeera/CNBC/NPR); Vance: IAEA inspectors invited; Iran FM disputes; Lebanon deconfliction agreed.
- **Day 114**: Jun 24 — Brent -5.3% to ~$73.87 on tanker traffic recovery; Goldman cuts Q4 Brent to $80 from $90; WTI briefly below $70 (CNBC); tail 9%.
- **Day 115**: Jun 25 — Brent +1.76% to $75.04 (TradingEconomics confirmed); WTI ~$69.95 est.; Gold $4,040.30 (TradingEconomics confirmed); mine-clearing Day 6; tail 9%.
- **Day 116**: Jun 26 — Brent $75.04 carried (Jun 25 confirmed); roadmap holds; IAEA access disputed; mine-clearing Day 7 of 30-day mandate; Goldman Q4 $80; tail 8%.

> **Add each new day's headline here on the day it occurs.** Keep each entry ≤25 words; note the single most market-significant event first.

### Price Narratives (update daily — keep synchronized with `banker-cross-asset.json`)

> **Update this section every morning** alongside cross-asset data. Replace the prior-day levels; do not accumulate historical milestones beyond the 3 most significant inflection points.

- **Brent**: Pre-shock ~$65 → $126 wartime high intraday (Day 59, Apr 30, CNBC/CNN) → $98.57 (Jun 3 D93 peak; Qeshm strike + Kuwait airport + Rubio rejection) → $75.04 (Jun 25, TradingEconomics confirmed, +1.76%; -24% from D93 peak). Roadmap agreed Jun 22-23 Switzerland; Goldman cuts Q4 to $80 from $90 (Investing.com) — GCC exports normalised by end-Jul. Mine-clearing Day 7 of 30-day mandate from Jun 19. Working range $70-85 base; $80-95 stress; $110-130 on deal collapse (tail 8%).
- **JKM LNG**: Baseline $9.5 → $23.40/MMBtu (Day 20, Reuters/Platts) → $18.86/MMBtu (last confirmed Jun 12, TradingEconomics; carried). Ras Laffan restart not before late Aug 2026 even on deal; mine-clearing 30-day mandate from Jun 19 (physical reopening late-2026 on central route); JKM supply lag means LNG stays elevated well after roadmap agreement.
- **TTF Gas**: Pre-shock ~$34/MWh → €49.97/MWh (Day 33) → €49.50/MWh (Jun 3 D93 peak) → €41.54/MWh est. (Jun 26; carried; roadmap progress continued de-escalation unwinding crisis premium)
- **Credit**: iTraxx Asia IG est. ~128bp (Jun 26, -67bp from D93 195bp peak; -11bp from D109 139bp); ASEAN HY est. ~460bp (-120bp from D93 580bp; -28bp from D109 488bp); trim CDS protection; remove fully at confirmed mine clearance + physical Hormuz reopening (~115-120bp target); tail 8% (deal collapse spikes to 200-230bp)

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
