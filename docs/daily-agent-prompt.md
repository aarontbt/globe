# Daily Agent Prompt — ASEAN Globe Market Brief

> **This is the lean daily execution file.** Load ONLY this file for routine daily updates.
> Consult `docs/daily-update-runbook.md` only for schema details, rare ops (new client, new sanctions entry), or field-level guidance.

---

## State Block *(update this first, every run)*

| Field | Value |
|-------|-------|
| **asOf** | 2026-04-12T00:00:00Z |
| **Day** | D42 |
| **Crisis Level** | 4 — High (ceasefire active Apr 8; fragile — no Hormuz deal) |
| **Last Brent** | $95.20 (D40, Apr 10, confirmed TradingEconomics) |
| **Last JKM** | $19.42/MMBtu (D40, Apr 10, confirmed TradingEconomics) |
| **Last TTF** | €44.46/MWh (D40, Apr 10, confirmed OilPriceAPI) |

---

## Daily Source Lookup

| Asset | Primary Source | Ticker / Access |
|-------|---------------|-----------------|
| Brent crude | TradingEconomics, Reuters, EIA | TradingView `UKOIL`; Bloomberg `CO1 Comdty` |
| WTI crude | Reuters, EIA, FRED | FRED `DCOILWTICO`; OilPriceAPI |
| TTF Gas | TradingEconomics, OilPriceAPI | Barchart `TGJ26`; ICE TTF front-month |
| JKM LNG | Reuters (Platts), TradingEconomics | Bloomberg `JKMNEDAN`; CME JKM futures |
| Gold | Investing.com, MarketWatch | Spot XAU/USD |
| USD/SGD, IDR, MYR, THB, PHP | Reuters, xe.com | Directional only if unconfirmed |
| Indonesia/Philippines/Thailand 10Y | Investing.com sovereign pages | `GIDN10YR`, `GPHL10YR`, `GTHA10YR` |
| iTraxx Asia ex-Japan IG | Bloomberg, Markit | Bloomberg `ITRXAXIG5Y Index` |
| ASEAN HY Composite | JPMorgan CEMBI, BAML | Bloomberg CEMBI |
| Baltic Dry Index | Baltic Exchange, TradingEconomics | Bloomberg `BDIY Index` |
| VLCC AG-Asia | Clarkson, Platts Dirty Tanker | Last confirmed Baltic/Clarkson close |
| Geopolitical | Reuters, AP, Al Jazeera, Long War Journal | CBS News, NBC News, CNBC |

**Validation rule**: Before entering any number, name its source. If you can't, write `(est.)` — acceptable for EM FX/rates only. Never estimate energy prices and present them as confirmed.

---

## Files to Update *(ordered by dependency)*

### 1. `src/data/banker-cross-asset.json`
- Set `"asOf"` → today at `T00:00:00Z`
- For each of the 13 assets: update `"current"`, `"change1d"` (always signed: `"+1.5%"` or `"-7bp"`)
- Recalculate `"zscore"` = `(current - baseline90d) / stddev`; set `"signal"`: `"red"` >2.0 · `"amber"` 1.0–2.0 · `"green"` <1.0
- **Do not** update `baseline30d` / `baseline90d` — those are monthly/quarterly

### 2. `src/hooks/useMarkets.ts` — `FALLBACK_QUOTES` (line 7)
- Update `price`, `change` (absolute $), `changePct` (%), `lastUpdated` for Brent, WTI, Gold
- Format: `lastUpdated: "YYYY-MM-DDT00:00:00Z"`

### 3. `src/components/MarketsWidget.tsx` — hardcoded constants (lines 11–13)
- `NEAR_TERM_RANGE` — Brent near-term range string e.g. `"90-115"` — update when scenario shifts
- `SUSTAINED_PRICE` — tail Brent level string e.g. `"160"` — update when tail scenario changes
- `TOP_ALERT` — one-sentence rolling news banner ≤25 words; replace with today's top event

### 4. `src/data/banker-conflict.json`
- Replace all 3 `todaysEvents` objects (never accumulate — replace entirely)
  - Each `summary` ≤25 words; end with date `(Apr N)`
  - `direction`: `"up"` escalation · `"down"` de-escalation · `"neutral"` lateral
- Update `deltaVsYesterday`: +1 (escalated) · 0 (flat) · -1 (de-escalated)
- Update `escalationLevel` (1–5) and `escalationLabel`
- Verify `scenarios[].probability` Base + Stress + Tail = **100**

### 5. `src/data/charts-volatility.json` — **APPEND ONLY, never delete**
- Add one new entry at the end of the `"days"` array:
  ```json
  {
    "day": "D43",
    "date": "2026-04-13",
    "note": "<concise event summary, cite source>",
    "ovx": <carry prior if unconfirmed>, "ovxConfirmed": false,
    "vxeem": <carry prior if unconfirmed>, "vxeemConfirmed": false,
    "scenarios": [<base>, <stress>, <tail>],
    "scenariosConfirmed": true
  }
  ```
- `scenarios` must match `banker-conflict.json` probabilities exactly
- Weekend/holiday: carry prior OVX/VXEEM with `Confirmed: false`

### 6. `src/data/iran-intel-events.json`
**Rewrite** (do not prepend "Day N:") these three — max 150 words each:
- `ship-001` — lead with current AIS transit count, trapped tanker count, most recent attack
- `sec-005` — replace title with today's single top security event (≤8 words); rewrite description
- `supply-001` — refresh Brent, JKM, TTF figures and AIS count

**Update price references only** in:
- `energy-003` — Brent figure; analyst forecast if materially changed
- `trade-001` — "currently trading ~$X/bbl" Brent figure
- `trade-003` — Brent figure; analyst threshold if changed
- `diplo-003` — add one sentence for new ASEAN diplomatic development; trim oldest to stay ≤150 words

### 7. `src/data/commodities-impact.json`
- Update top-level `"asOf"` → today
- For all 14 assets: update `"current"`, `"change1d"`, recalculate `"zscore"` / `"signal"`
- Update `"narrative"` only if the supply chain mechanism changed (new force majeure, route change)
- Update `"scenario"` field only if the primary disruption vector changed

### 8. `src/data/banker-trade-ideas.json`
- Update date references (e.g. `"Apr 9"` → today's date) in `rationale`
- Refresh price citations in `rationale` to match today's cross-asset data
- Adjust `conviction` if scenario probability shifted materially
- Check `cfTrigger` urgency: `critical` ≤72h · `high` ≤2 weeks · `medium` no pressure · `low` monitor
- **Do not** create a new entry for updates to an existing theme — edit existing `rationale`

### 9. `src/data/banker-sanctions.json`
- Check overnight OFAC / EU / UN designations
- Add new entry at top of `sanctionsEntries` only if a new designation occurred (see runbook §6 for schema)
- Update `s0` description if MAS/SGX actions occurred

### 10. `docs/daily-update-runbook.md` — **log maintenance (append only)**
- **Crisis Timeline**: append today's entry at the bottom — `- **Day N**: Mon DD — [event]; Brent $X (+Y%)` ≤25 words
- **Price Narratives**: replace prior-day Brent/JKM/TTF lines with today's confirmed levels; keep only last 3 inflection points
- **State Block**: update `Last updated`, `Brent`, `JKM`, `TTF` fields at the top of the runbook

---

## Validation Checklist

1. **Source check**: every number has a named source — or is marked `(est.)`
2. **Geopolitical events**: cite outlet in summary (Reuters, AP, Al Jazeera, etc.)
3. **Scenario probabilities**: Base + Stress + Tail = **100** (hard constraint)
4. **JSON syntax**: run for each modified file — `node -e "JSON.parse(require('fs').readFileSync('./src/data/<FILE>.json','utf8'))"`
5. **Build**: `bun run build` — zero TypeScript errors before done

---

## Format Quick-Reference

| Rule | Format |
|------|--------|
| `change1d` | Always signed: `"+1.5%"` `"-7bp"` `"+0.4%"` |
| Dashes | Space-hyphen-space ` - ` (never em dash `—`) |
| Dates | ISO 8601: `"2026-04-13T00:00:00Z"` |
| `signal` | `"green"` · `"amber"` · `"red"` (lowercase) |
| Exposure scores | Integers 1–10 (not 0–10) |
| Scenario `id` fields | Never change — stable identifiers |

---

## Day-by-Day Log Rules

Both logs below are **permanent records — never delete entries, append only**:

| Log | File | Action |
|-----|------|--------|
| Crisis Timeline | `docs/daily-update-runbook.md` → bottom | Append one line ≤25 words |
| Volatility Log | `src/data/charts-volatility.json` → `days[]` | Append one JSON object |

The two logs must stay in sync: `scenarios[]` in volatility log = `probability` in `banker-conflict.json` for the same day.
