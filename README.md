# ASEAN Maritime Intelligence Dashboard

An interactive 3D globe visualization of ASEAN maritime trade routes, shipping lanes, geopolitical events, live market data, and social media signals — built for analytical storytelling in a pitch or advisory setting.

## Features

- **3D Interactive Globe** — Rotatable, zoomable globe centered on Southeast Asia using deck.gl's `_GlobeView`
- **Shipping Lanes** — Global and ASEAN-specific lanes with glow + core path rendering
- **Trade Corridors** — 10 curated ASEAN trade corridors with commodity narratives (Malacca Strait, South China Sea, Sunda/Lombok Straits, Nickel Belt, etc.)
- **Port Nodes** — 20 ports (12 ASEAN + 8 partner), sized by TEU throughput, color-coded by type
- **Trade Arcs** — 14 bilateral trade flows rendered as great-circle arcs with USD values
- **Animated Vessels** — ~80 vessels animating along shipping lanes in real time
- **Geopolitical Event Rings** — Pulsing animated rings for ASEAN-focused intelligence events across 6 categories: Security, Political, Economic, Climate, Election, Diplomatic
- **Iran Intel Layer** — Dedicated Iran conflict scenario events covering energy, shipping, diplomatic, and supply-chain impacts across ASEAN
- **Oil Supply Chain Layer** — Production, refinery, storage, and consumption nodes with crude/product arc flows
- **Satellite Layer** — Live orbital positions sourced from Celestrak TLE data, animated on the globe
- **Country Labels** — Muted globe-projected country name overlays
- **Event Panel** — Filterable side panel showing event cards with probability indicators
- **Layer Toggle Panel** — Per-layer show/hide controls
- **Rich Tooltips** — Context-sensitive hover info for ports, corridors, trade arcs, and events
- **Live Markets Widget** — Real-time Brent Crude, LNG, and Gold quotes with sparklines, bid/ask spreads, session highs/lows, and a swarm forecast panel (via Stooq, 5-min cache)
- **News Widget** — Live news headlines with source attribution and cache-age indicator
- **Social Media Signal Monitor** — Aggregated signal feed from GDELT, Reddit, and Bluesky
- **CGTN Live Feed** — Embedded live broadcast widget
- **Performance Monitor** — FPS and frame-time overlay

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Vite 6 + React 18 + TypeScript |
| Globe Engine | deck.gl 9.1 (`_GlobeView`) |
| Map Layer | MapLibre GL 4.7 + react-map-gl 7 |
| Styling | Tailwind CSS 4 |
| Satellite Orbits | satellite.js 6 |
| Basemap Data | Natural Earth via deck.gl CDN (no API key required) |

## Getting Started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Static output to dist/
npm run preview  # Preview the production build
```

## Project Structure

```
src/
├── App.tsx                      # Root component
├── components/
│   ├── GlobeView.tsx            # Main globe + layer orchestration
│   ├── EventPanel.tsx           # Sliding side panel for events
│   ├── LayerTogglePanel.tsx     # Layer visibility controls
│   ├── LegendPanel.tsx          # Map legend
│   ├── TitleOverlay.tsx         # Top-left title card
│   ├── MarketsWidget.tsx        # Live market quotes + swarm forecast
│   ├── NewsWidget.tsx           # Live news headlines
│   ├── LiveFeedWidget.tsx       # Embedded CGTN live broadcast
│   ├── DataSources.tsx          # Data source attribution panel
│   ├── PerformanceMonitor.tsx   # FPS / frame-time overlay
│   └── market-brief/            # Market brief document components
├── layers/
│   ├── shippingLanes.ts         # Global lane PathLayer
│   ├── corridors.ts             # ASEAN corridor glow + core layers
│   ├── ports.ts                 # Port ScatterplotLayer
│   ├── tradeArcs.ts             # Bilateral trade ArcLayer
│   ├── animatedVessels.ts       # rAF-animated vessel dots
│   ├── globeEvents.ts           # Pulsing event rings + dots
│   ├── oilSupplyChain.ts        # Oil node + crude/product arc layers
│   ├── satellites.ts            # Live satellite IconLayer
│   └── countryLabels.ts         # Globe-projected country TextLayer
├── hooks/
│   ├── useVesselAnimation.ts    # Vessel position interpolation
│   ├── useEventPulse.ts         # 0→1 pulse cycle for ring animation
│   ├── usePolymarketEvents.ts   # Prediction market event hook
│   ├── useMarkets.ts            # Live market quote polling
│   ├── useNews.ts               # News feed hook
│   ├── useSatellites.ts         # Celestrak TLE fetch + SGP4 propagation
│   ├── useCountryLabels.ts      # Country label data hook
│   ├── useGdeltEvents.ts        # GDELT event signal hook
│   ├── useRedditSignals.ts      # Reddit signal hook
│   ├── useBlueskySignals.ts     # Bluesky signal hook
│   ├── useSocialSignals.ts      # Aggregated social signal hook
│   └── useAsteroidImpacts.ts    # Asteroid impact data hook
├── services/
│   ├── marketsService.ts        # Stooq market quote fetcher (5-min cache)
│   ├── newsService.ts           # News API service
│   ├── gdeltService.ts          # GDELT API service
│   ├── redditService.ts         # Reddit API service
│   ├── bskyService.ts           # Bluesky API service
│   ├── celestrakService.ts      # Celestrak TLE fetcher
│   └── polymarket.ts            # Polymarket prediction market service
├── data/
│   ├── globe-events.json        # ASEAN geopolitical events
│   ├── iran-intel-events.json   # Iran conflict intelligence events
│   ├── corridors.json           # 10 trade corridors with narratives
│   ├── ports.json               # Port nodes with TEU data
│   ├── trade-arcs.json          # Bilateral trade flow data
│   ├── oil-supply-chain.json    # Oil node + route data
│   ├── narrative-zones.json     # Narrative zone polygons
│   ├── shipping-lanes.json      # ASEAN shipping lane paths
│   ├── global-lane-paths.json   # Full global lane path data
│   ├── banker-clients.json      # Banker client profile data
│   ├── banker-conflict.json     # Conflict scenario data for bankers
│   ├── banker-cross-asset.json  # Cross-asset intelligence
│   ├── banker-sanctions.json    # Sanctions exposure data
│   └── banker-trade-ideas.json  # Trade idea data
└── types/
    └── index.ts                 # Shared TypeScript interfaces
public/
├── shipping_lanes.json          # Full global shipping lane GeoJSON
└── shipping_lanes_stitched.json
```

## Data Sources

- **Shipping lanes** — Derived from Global Fishing Watch AIS density data patterns
- **Ports** — 2023 TEU throughput approximations for major ASEAN and partner ports
- **Trade corridors** — Curated ASEAN trade routes with commodity intelligence narratives
- **Geopolitical events** — ASEAN-focused scenarios with probability estimates; Iran intel events cross-verified against live sources
- **Oil supply chain** — Production, refinery, storage, and consumption node data with crude/product flows
- **Live markets** — Brent Crude (BZ=F), LNG (NG=F), Gold (GC=F) via Stooq free CSV endpoint; 5-minute client-side cache
- **Satellite orbits** — Live TLE data from Celestrak, propagated client-side using satellite.js (SGP4)
- **Social signals** — GDELT, Reddit, and Bluesky APIs aggregated into a unified signal feed
- **News** — Live headline feed via news service

## Iframe Embedding (engine.rainmarket.com)

This app is designed to be embedded inside `engine.rainmarket.com`. The headers are configured in `vercel.json`:

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      {
        "key": "Content-Security-Policy",
        "value": "frame-ancestors 'self' https://engine.rainmarket.com"
      },
      {
        "key": "X-Frame-Options",
        "value": "ALLOW-FROM https://engine.rainmarket.com"
      }
    ]
  }
]
```

- `Content-Security-Policy: frame-ancestors` — what modern browsers enforce
- `X-Frame-Options: ALLOW-FROM` — legacy fallback for older browsers

## Architecture Notes

- `_GlobeView` from `@deck.gl/core` is an experimental API; it is cast as `any` to work around TypeScript constructor limitations
- No MapLibre basemap is used on the globe — country fills and borders are rendered via `GeoJsonLayer` using Natural Earth GeoJSON from the deck.gl CDN
- Event rings use 3 rings per event at 120° phase offsets, scaling from 80k to 480k meters radius
- Vessel animation runs on `requestAnimationFrame` via a custom hook, returning interpolated coordinates along lane paths
- Country labels use `getAngle: 180` to counteract `_GlobeView`'s billboard geometry axis inversion
- Market quotes are fetched from Stooq's free CSV endpoint with a 5-minute `localStorage` cache to avoid rate limiting
- Satellite positions are computed client-side from live TLE sets using SGP4 propagation (satellite.js)
