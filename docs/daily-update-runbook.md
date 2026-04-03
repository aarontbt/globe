# Market Brief Update Guide

**Purpose**: Step-by-step instructions for an AI agent or human analyst to update the Market Brief overlay data in the ASEAN maritime intelligence globe demo. All data is in static JSON files in `src/data/`. No API layer exists — changes take effect immediately on `bun run dev`.

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

| Asset | Primary Source | Backup |
|-------|---------------|--------|
| Brent crude | Qatar News Agency, Reuters, EIA | Trading Economics |
| WTI crude | Qatar News Agency, Reuters, EIA | FRED St Louis Fed |
| TTF Gas | Trading Economics, ICE, Investing.com historical | Reuters |
| JKM LNG | Reuters (Platts assessment), globallnghub.com | CME JKM futures |
| Gold | Trading Economics, MarketWatch | Investing.com |
| EM FX (SGD, IDR, MYR, THB, PHP) | Reuters, Bloomberg FX | xe.com (directional only) |
| EM Rates | Bloomberg sovereign pages, Investing.com | Reuters |
| OVX | CBOE CDN (`OVX_History.csv`) — fetched live on page load | charts-volatility.json fallback |
| VXEEM | CBOE CDN (`VXEEM_History.csv`) — fetched live on page load | charts-volatility.json fallback |
| Geopolitical events | Reuters, AP, Al Jazeera, Long War Journal, Axios, FT | PBS NewsHour, Washington Post |
| AIS/shipping data | VT Markets, MarineLink, SSY/Argus | Bloomberg shipping |

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

### Schema

```json
{
  "asOf": "YYYY-MM-DDT08:00:00Z",
  "categories": [
    {
      "id": "energy",
      "label": "Energy",
      "assets": [
        {
          "id": "brent",
          "name": "Brent Crude",
          "current": 79.40,
          "unit": "$/bbl",
          "change1d": "+1.5%",
          "baseline30d": 75.2,
          "baseline90d": 78.4,
          "zscore": 2.2,
          "signal": "red"
        }
      ]
    }
  ]
}
```

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

### Where to Find Data

- **Brent/WTI**: Bloomberg `CO1 Comdty` / `CL1 Comdty`; TradingView: `UKOIL`, `USOIL`
- **TTF Gas**: Bloomberg `TTFMBASE Index`; ICE TTF front-month
- **JKM LNG**: Platts JKM assessment; Bloomberg `JKMNEDAN Index`
- **EM Rates**: Bloomberg sovereign bond pages (e.g., `GIDN10YR`, `GPHL10YR`, `GTHA10YR`)
- **iTraxx Asia ex-Japan IG**: Bloomberg `ITRXAXIG5Y Index`; Markit
- **ASEAN HY**: BAML ASEAN HY indices; JPMorgan CEMBI
- **EM FX**: Bloomberg FX (SGD, IDR, MYR, THB, PHP vs USD); Reuters ASEAN page
- **Equity indices**: MSCI ASEAN Energy, SGX shipping sub-index, MSCI ASEAN Banks

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

## 3. Client Roster (`banker-clients.json`)

### Schema

```json
{
  "clients": [
    {
      "id": "pttep",
      "name": "PTTEP",
      "sector": "Upstream Oil & Gas",
      "country": "Thailand",
      "exposure": {
        "energyCosts": 2,
        "shipping": 5,
        "sanctions": 4,
        "refinancing": 5
      },
      "scenarioImpacts": {
        "base": "...",
        "stress": "...",
        "tail": "..."
      },
      "talkingPoints": [
        "Data point → recommendation...",
        "Data point → recommendation...",
        "Data point → recommendation..."
      ]
    }
  ]
}
```

### Exposure Score Guide (1-10)

| Dimension | 1-3 (Low) | 4-6 (Moderate) | 7-10 (High) |
|-----------|-----------|----------------|-------------|
| `energyCosts` | Producer/exporter benefits from oil spike | Mixed/indirect exposure | Major importer; energy is >20% of cost base |
| `shipping` | No vessel fleet; landlocked ops | Some chartered tonnage; modest route exposure | Large owned/chartered fleet; route-dependent |
| `sanctions` | No Iran/Russia exposure | Moderate shadow fleet or counterparty risk | Direct designation risk or correspondent exposure |
| `refinancing` | Strong balance sheet; no near-term maturity | Moderate debt; 12-24mo maturity | High leverage; near-term maturity; limited access |

### Client Roster Conventions

- IDs are **permanent slugs** — do not change once set (they may be referenced in `cfTriggers`)
- Sector should be specific: `"Upstream Oil & Gas"` not just `"Energy"`
- Country is the **primary listing/HQ country**
- Keep 3 `talkingPoints` per client — quality over quantity; each must contain a current data point (price, rate, index level)

### Adding a New Client

1. Choose a unique lowercase slug (`id`)
2. Set exposure scores honestly (1-10)
3. Write 3 scenario impacts (base/stress/tail) that reference current oil/LNG/FX levels
4. Write 3 talking points — each starting with a specific market data reference
5. If this client is a `cfTrigger` target, update `banker-trade-ideas.json` accordingly

---

## 4. Conflict Status (`banker-conflict.json`)

### Schema

```json
{
  "escalationLevel": 4,
  "escalationLabel": "High",
  "deltaVsYesterday": 1,
  "todaysEvents": [
    {
      "id": "e1",
      "summary": "Description with date reference (Mar 3)",
      "delta": "Short label (3-5 words)",
      "direction": "up | neutral | down"
    }
  ],
  "scenarios": [
    {
      "id": "base",
      "label": "Base",
      "probability": 42,
      "description": "...",
      "oilImpact": "+$10/bbl",
      "lngImpact": "+55%"
    }
  ]
}
```

### Escalation Levels

| Level | Label | Description |
|-------|-------|-------------|
| 1 | Normal | No active escalation |
| 2 | Elevated | Diplomatic tension, no kinetic activity |
| 3 | Heightened | Military positioning, sanctions enforcement active |
| 4 | High | Active strikes or closures; market impact material |
| 5 | Severe | Full theatre conflict; systemic market disruption |

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

### Schema

```json
{
  "tradeIdeas": [
    {
      "id": "t0",
      "title": "Trade title (instrument-specific)",
      "rationale": "Narrative with current prices cited...",
      "instruments": ["Specific instrument 1", "Specific instrument 2"],
      "direction": "long | short | hedge",
      "conviction": "high | medium | low"
    }
  ],
  "cfTriggers": [
    {
      "id": "cf0",
      "client": "Client Name (matches clients.json name field)",
      "trigger": "refi | liquidity | M&A target | hedge | other",
      "description": "Client-specific action trigger with urgency rationale...",
      "urgency": "critical | high | medium | low"
    }
  ]
}
```

### Daily Update Process

1. Update price references in `rationale` to match current cross-asset data
2. Change date references (`Mar 2` → `Mar 3`) where specific dates appear
3. Update `cfTriggers` client names if client roster changes (must match `name` field in `banker-clients.json`)
4. Adjust `conviction` level if scenario probability shifts materially
5. Do **not** change `id` fields — these are stable identifiers

### cfTrigger Urgency Guide

| Urgency | Meaning |
|---------|---------|
| `critical` | Execute within 48-72 hours; market window closing |
| `high` | Recommended within 2 weeks; conditions favourable |
| `medium` | Worth preparing; no immediate time pressure |
| `low` | Monitor only; conditions not yet ripe |

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

### Schema

```json
{
  "asOf": "2026-03-26T00:00:00Z",
  "scenario": "One-line description of current disruption mechanism",
  "categories": [
    {
      "id": "food",
      "label": "Food & Agriculture",
      "supplyChainImpact": "Paragraph explaining how Hormuz closure affects this category (2-4 sentences).",
      "assets": [
        {
          "id": "wheat",
          "name": "Wheat",
          "current": 692,
          "unit": "¢/bu",
          "change1d": "+3.2%",
          "baseline30d": 620,
          "baseline90d": 578,
          "zscore": 2.6,
          "signal": "red",
          "narrative": "Crisis-specific context for this asset (2-3 sentences). Why is it moving? What is the supply chain mechanism?"
        }
      ]
    }
  ]
}
```

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
| `zscore` | `(current - baseline90d) / stddev`; same guide as cross-asset: >2.0 = red, 1.0–2.0 = amber, <1.0 = green |
| `signal` | `"red"` / `"amber"` / `"green"` — drives the signal dot on each asset row |
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

### Adding or Retiring an Asset

**Adding**: Insert new object in the relevant category's `assets` array. Must include all fields. Choose a unit consistent with market convention for that commodity. Set baselines from 30d and 90d historical price data.

**Retiring**: Remove the asset object if the market is no longer relevant (e.g., a shipping lane fully normalises and the freight rate returns to pre-crisis levels). Do **not** set `signal: "green"` as a proxy for retirement — either the asset is monitored or it is removed.

**Adding a category**: Add a new object to `categories` with `id`, `label`, `supplyChainImpact`, and at least 2 `assets`. The `CommoditiesImpactPanel` component iterates all categories generically — no code change required.

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

1. `bun run dev` (or `npm run dev`) in `/globe`
2. Open `http://localhost:5173`
3. Click **MARKET BRIEF** (top center)
4. Verify each tab:
   - **Client Brief**: Correct 6 clients appear with current sector/country
   - **Cross-Asset**: `asOf` shows today's date; Brent price matches update
   - **Conflict**: Events show today's date; scenario probabilities sum to 100%
   - **Trade Ideas**: `cfTriggers` reference the correct client names
   - **Sanctions**: Most recent entry reflects latest developments
5. Close Market Brief overlay; check right panel tabs:
   - **EVENTS**: Intel events visible; no Polymarket (`pm-`) events shown; category filters work
   - **PREDICTIONS**: Polymarket markets load with volume/liquidity stats; "Open" links resolve
   - **SUPPLY CHAIN**: All 4 categories present (Food, Petrochemicals, Fertilizers, Shipping); `asOf` matches today; click any asset row to confirm narrative expands
6. Open browser console — no errors on any panel
6. Check ticker bar (top of globe) — fallback prices match `useMarkets.ts` values

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

> **Add each new day's headline here on the day it occurs.** Keep each entry ≤25 words; note the single most market-significant event first.

### Price Narratives (update daily — keep synchronized with `banker-cross-asset.json`)

> **Update this section every morning** alongside cross-asset data. Replace the prior-day levels; do not accumulate historical milestones beyond the 3 most significant inflection points.

- **Brent**: Pre-shock ~$65 → $121.40 (Day 20 close, +7.6%) → $115.93 (Day 30, confirmed Al Jazeera/oilpriceapi) → $100.64 (Day 31, Reuters Apr 1, -13.2% tactical dip) → $109.03 (Day 33, confirmed Gulf News/CNBC Apr 3, +8.3% on Trump 'Stone Ages' escalation); working range $105-135 in stress; $160-185 tail on Kharg seizure + Saudi output cuts
- **JKM LNG**: Baseline $9.5 → $23.40/MMBtu (Day 20, Reuters/Platts confirmed) → ~$20.13/MMBtu (Day 33, Investing.com Apr 2-3, +6.0% on Trump escalation; toll booth constrains flows); Qatar Ras Laffan restart structurally blocked until political settlement; April 6 deadline acute; Asia spot tightness acute through H2 2026
- **TTF Gas**: Pre-shock ~$34/MWh → est. ~€74.20/MWh (Day 20) → €55.80/MWh (Day 30, oilpriceapi confirmed) → €49.97/MWh (Day 33, oilpriceapi Apr 2 16:03 UTC confirmed, -3.9% from Day 31; European gas decoupling from crude oil divergence); Qatar LNG hub suspension sustaining elevated European gas; April 6 next re-escalation trigger
- **Credit**: iTraxx Asia IG est. ~188bp (Day 33, +10bp; Trump 'Stone Ages' + UAE attack widening); ASEAN HY est. ~555bp (+20bp); 200-215bp iTraxx IG becomes April 6 event-risk target; Saudi output-cut risk from UAE attack adds systemic upside; tail risk 50%

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

---

### MarketsWidget.tsx Constants (update when scenario shifts)

| Constant | Purpose | Update trigger |
|----------|---------|----------------|
| `TOP_ALERT` | Alert strip headline | Any major new development (attacks, policy, succession) |
| `NEAR_TERM_RANGE` | Swarm forecast near-term ($/bbl) | Shift >3 days in disruption duration expectation |
| `SUSTAINED_PRICE` | Swarm forecast tail scenario ($/bbl) | Stress/tail scenario probability shifts materially |

When the scenario evolves (de-escalation, ceasefire, new actor), update:
1. `escalationLevel` and `todaysEvents` in `banker-conflict.json`
2. Scenario probabilities (Base/Stress/Tail)
3. Trade idea rationale references
4. `TOP_ALERT`, `NEAR_TERM_RANGE`, `SUSTAINED_PRICE` in `src/components/MarketsWidget.tsx`
5. Client talking points (especially oil-price-sensitive ones: PTTEP, Sapura, Wilmar, Hyflux)
6. Intel events in `iran-intel-events.json` — especially `ship-001`, `sec-005`, `supply-001`
