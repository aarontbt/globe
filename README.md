# ASEAN Maritime Intelligence Globe

Interactive deck.gl globe for ASEAN trade, maritime risk, and banker-style market briefing workflows. The app combines curated static scenario data with a small set of live market, news, social, satellite, and prediction-market feeds exposed through browser-safe proxies.

## What It Does

- Renders a 3D globe centered on Southeast Asia using deck.gl `_GlobeView`
- Visualizes shipping lanes, trade corridors, ports, trade arcs, oil supply-chain routes, and optional crisis-vessel overlays
- Merges three event streams into a single event layer:
  - curated ASEAN and Iran scenario events from static JSON
  - live Polymarket event signals
  - live social signal events from GDELT, Reddit, and Bluesky
- Shows live market and news widgets alongside the globe
- Includes a full-screen `MARKET BRIEF` overlay with six banker-facing tabs:
  - Conflict Status
  - Cross-Asset
  - Client Exposure
  - Trade Ideas
  - Sanctions
  - Client Brief
- Adds a bottom scenario/volatility panel with live CBOE overlays for `OVX` and `VXEEM`

## Stack

| Area | Technology |
|---|---|
| App | React 18 + TypeScript + Vite 6 |
| Styling | Tailwind CSS 4 + inline component styling |
| Globe / rendering | deck.gl 9.1 |
| Mapping primitives | GeoJsonLayer, ArcLayer, PathLayer, ScatterplotLayer, TextLayer |
| Satellite propagation | `satellite.js` |
| Deployment target | Vercel static app + API rewrites |

## Local Development

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:5173`

Production build:

```bash
npm run build
npm run preview
```

## Live Data Model

The app is mostly static-data driven, but several panels fetch live or near-live data through `/api/*` proxies.

### Live feeds

- `Polymarket` via `/api/polymarket`
- `Yahoo Finance` with `Stooq` fallback for market quotes
- `CBOE CDN` for `OVX` and `VXEEM` history
- `CNA` and `BBC` RSS feeds for news headlines
- `CelesTrak` for satellite TLEs
- `GDELT`, `Reddit`, and `Bluesky` for social signal ingestion

### Browser caching

- Market quotes: 5 minutes
- News: 10 minutes
- Widget-level fallback values exist for markets, news, and volatility panels so the UI stays populated if a live fetch fails

## Data Workflow

Two data models coexist in the repo:

### 1. Static scenario / briefing data

Files under [`src/data`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/data) drive the banker overlay and scenario storytelling. The most important daily-maintained files are:

- [`src/data/banker-cross-asset.json`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/data/banker-cross-asset.json)
- [`src/data/banker-conflict.json`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/data/banker-conflict.json)
- [`src/data/banker-trade-ideas.json`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/data/banker-trade-ideas.json)
- [`src/data/banker-sanctions.json`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/data/banker-sanctions.json)
- [`src/data/charts-volatility.json`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/data/charts-volatility.json)
- [`src/data/iran-intel-events.json`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/data/iran-intel-events.json)

The operational runbook for those updates lives in [`docs/daily-update-runbook.md`](/Users/xenohawk/Downloads/rainmarket-demo/globe/docs/daily-update-runbook.md).

### 2. Live overlay data

Hooks and services under [`src/hooks`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/hooks) and [`src/services`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/services) fetch live data and normalize it into the UI.

## Main UI Surfaces

### Globe layers

- Global shipping lanes
- Trade corridors
- Ports
- Trade arcs
- Animated vessels
- Event rings and dots
- Oil supply chain
- Optional crisis vessels
- Optional satellites
- Country labels

### Overlays

- [`TitleOverlay`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/TitleOverlay.tsx)
- [`LayerTogglePanel`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/LayerTogglePanel.tsx)
- [`EventPanel`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/EventPanel.tsx)
- [`MarketsWidget`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/MarketsWidget.tsx)
- [`NewsWidget`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/NewsWidget.tsx)
- [`BottomChartsPanel`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/BottomChartsPanel.tsx)
- [`DataSources`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/DataSources.tsx)
- [`PerformanceMonitor`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/PerformanceMonitor.tsx)
- [`MarketBriefOverlay`](/Users/xenohawk/Downloads/rainmarket-demo/globe/src/components/market-brief/MarketBriefOverlay.tsx)

## Project Structure

```text
src/
  App.tsx
  components/
    GlobeView.tsx
    EventPanel.tsx
    LayerTogglePanel.tsx
    MarketsWidget.tsx
    NewsWidget.tsx
    BottomChartsPanel.tsx
    DataSources.tsx
    LiveFeedWidget.tsx
    PerformanceMonitor.tsx
    market-brief/
  hooks/
    useMarkets.ts
    useNews.ts
    usePolymarketEvents.ts
    useSocialSignals.ts
    useSatellites.ts
    useVesselAnimation.ts
  services/
    marketsService.ts
    newsService.ts
    polymarket.ts
    gdeltService.ts
    redditService.ts
    bskyService.ts
    celestrakService.ts
  layers/
  data/
api/
docs/
```

## API Proxy Notes

Local development uses the Vite dev proxy configured in [`vite.config.ts`](/Users/xenohawk/Downloads/rainmarket-demo/globe/vite.config.ts). Production uses lightweight Vercel rewrites/functions defined in [`vercel.json`](/Users/xenohawk/Downloads/rainmarket-demo/globe/vercel.json) and the `api/` directory.

Notable proxied paths:

- `/api/polymarket`
- `/api/yahoo`
- `/api/stooq`
- `/api/cboe`
- `/api/rss/cna`
- `/api/rss/bbc`
- `/api/celestrak`
- `/api/gdelt`
- `/api/reddit`

## Key Implementation Notes

- `_GlobeView` is used directly from `@deck.gl/core` and instantiated once for the scene
- The globe basemap is rendered from Natural Earth GeoJSON over deck.gl, not MapLibre tiles
- Country labels are filtered by camera angle to avoid stencil clipping at the horizon
- The event layer is a merged stream of static events, Polymarket events, and social signals
- `OVX` and `VXEEM` fall back to static history in `charts-volatility.json` and are replaced live when CBOE fetches succeed
- The banker overlay is fully static-data driven, so content changes are immediate once the JSON files are updated

## Validation

For data-only updates, the minimum safe check is:

```bash
node -e "JSON.parse(require('fs').readFileSync('src/data/banker-cross-asset.json','utf8'))"
npm run build
```

For full daily refreshes, follow [`docs/daily-update-runbook.md`](/Users/xenohawk/Downloads/rainmarket-demo/globe/docs/daily-update-runbook.md).

## Embedding

The app is intended to be embeddable in `engine.rainmarket.com`. Frame ancestry headers are configured in [`vercel.json`](/Users/xenohawk/Downloads/rainmarket-demo/globe/vercel.json).
