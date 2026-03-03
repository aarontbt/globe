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
| `src/hooks/useMarkets.ts` | Ticker bar (fallback quotes) | Daily |

---

## Codebase Conventions

- **Client IDs**: lowercase slugs, no spaces (e.g., `"pttep"`, `"sapura"`, `"wilmar"`)
- **Exposure scores**: integers **1–10** (not 0-10)
- **`change1d` format**: always include sign prefix — `"+7bp"`, `"-3.7%"`, `"+0.4%"`
- **`signal` values**: `"green"` | `"amber"` | `"red"`
- **All dates**: ISO 8601 — `"2026-03-03T08:00:00Z"`
- **Scenario narrative tone**: institutional/banker — factual, instrument-specific, no marketing language
- **Talking points**: 3 per client; each starts with a data point then a recommendation

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
| `zscore` | `(current - baseline90d) / stddev`; rough guide: >2.0 = red, 1.0–2.0 = amber, <1.0 = green |
| `signal` | `"red"` if zscore >2.0 or strong move; `"amber"` for moderate; `"green"` for normal |

### Categories to Update Daily

1. **Energy** — Brent, TTF Gas, JKM LNG
2. **EM Rates** — Indonesia 10Y, Philippines 10Y, Thailand 10Y
3. **Credit Spreads** — iTraxx Asia ex-Japan IG (bp), ASEAN HY Composite (bp)
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

### Exposure Score Guide (1–10)

| Dimension | 1–3 (Low) | 4–6 (Moderate) | 7–10 (High) |
|-----------|-----------|----------------|-------------|
| `energyCosts` | Producer/exporter benefits from oil spike | Mixed/indirect exposure | Major importer; energy is >20% of cost base |
| `shipping` | No vessel fleet; landlocked ops | Some chartered tonnage; modest route exposure | Large owned/chartered fleet; route-dependent |
| `sanctions` | No Iran/Russia exposure | Moderate shadow fleet or counterparty risk | Direct designation risk or correspondent exposure |
| `refinancing` | Strong balance sheet; no near-term maturity | Moderate debt; 12–24mo maturity | High leverage; near-term maturity; limited access |

### Client Roster Conventions

- IDs are **permanent slugs** — do not change once set (they may be referenced in `cfTriggers`)
- Sector should be specific: `"Upstream Oil & Gas"` not just `"Energy"`
- Country is the **primary listing/HQ country**
- Keep 3 `talkingPoints` per client — quality over quantity; each must contain a current data point (price, rate, index level)

### Adding a New Client

1. Choose a unique lowercase slug (`id`)
2. Set exposure scores honestly (1–10)
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
      "delta": "Short label (3–5 words)",
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
| `critical` | Execute within 48–72 hours; market window closing |
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

## Daily Update Checklist

### Morning Update (Pre-Market Open, ~08:00 SGT)

- [ ] **Cross-asset**: Update `asOf` date, refresh all `current` prices and `change1d` values
- [ ] **useMarkets.ts**: Update `FALLBACK_QUOTES` prices, changes, and `lastUpdated` dates
- [ ] **Conflict**: Replace `todaysEvents` with 3 new events; update `deltaVsYesterday`; verify scenario probabilities sum to 100
- [ ] **Trade ideas**: Update date references (e.g., "Mar N"); refresh price citations in rationale
- [ ] **Sanctions**: Check for overnight OFAC/EU announcements; update `s0` description if MAS/SGX actions occurred
- [ ] **Validate JSON**: Run `node -e "JSON.parse(require('fs').readFileSync('./src/data/<file>.json','utf8'))"` for each file
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
5. Open browser console — no errors on any panel
6. Check ticker bar (top of globe) — fallback prices match `useMarkets.ts` values

---

## Narrative Conventions (Iran Escalation Scenario)

- **Day 0**: Feb 28, 2026 — US-Israeli strikes on Iran; Khamenei killed
- **Day 1**: Mar 1 — Hormuz declared de facto war zone; transit halted
- **Day 2**: Mar 2 — ASEAN diplomatic responses; Philippines DOE warning
- **Day 3**: Mar 3 — Oman back-channel rejected; MAS emergency guidance; Saudi/UAE spare capacity activation
- **Brent narrative**: Surged from ~$65 pre-shock to $82+ peak; stabilising at $79–80 Day 3–4
- **JKM narrative**: From $9.5 baseline to $15.6+ as Asian buyers scramble; Qatar supply offline
- **Credit narrative**: iTraxx Asia IG from ~100bp pre-shock; hit 128bp Day 2; stabilising 132bp Day 3

When the scenario evolves (de-escalation, ceasefire, new actor), update:
1. `escalationLevel` and `todaysEvents` in `banker-conflict.json`
2. Scenario probabilities (Base/Stress/Tail)
3. Trade idea rationale references
4. Client talking points (especially oil-price-sensitive ones: PTTEP, Sapura, Wilmar, Hyflux)
