# ASEAN Maritime Intelligence Dashboard

An interactive 3D globe visualization of ASEAN maritime trade routes, shipping lanes, geopolitical events, and port activity — built for analytical storytelling in a pitch or advisory setting.

![ASEAN Maritime Intelligence](https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson)

## Features

- **3D Interactive Globe** — Rotatable, zoomable globe centered on Southeast Asia using deck.gl's `_GlobeView`
- **Shipping Lanes** — Global and ASEAN-specific lanes with glow + core path rendering
- **Trade Corridors** — 10 curated ASEAN trade corridors with commodity narratives (Malacca Strait, South China Sea, Sunda/Lombok Straits, Nickel Belt, etc.)
- **Port Nodes** — 20 ports (12 ASEAN + 8 partner), sized by TEU throughput, color-coded by type
- **Trade Arcs** — 14 bilateral trade flows rendered as great-circle arcs with USD values
- **Animated Vessels** — ~80 vessels animating along shipping lanes in real time
- **Geopolitical Event Rings** — Pulsing animated rings for 25 ASEAN-focused predictions across 6 categories: Security, Political, Economic, Climate, Election, Diplomatic
- **Event Panel** — Filterable side panel showing event cards with probability indicators
- **Layer Toggle Panel** — Per-layer show/hide controls
- **Rich Tooltips** — Context-sensitive hover info for ports, corridors, trade arcs, and events

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Vite 6 + React 18 + TypeScript |
| Globe Engine | deck.gl 9.1 (`_GlobeView`) |
| Map Layer | MapLibre GL 4.7 + react-map-gl 7 |
| Styling | Tailwind CSS 4 |
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
├── App.tsx                    # Root component
├── components/
│   ├── GlobeView.tsx          # Main globe + layer orchestration
│   ├── EventPanel.tsx         # Sliding side panel for events
│   ├── LayerTogglePanel.tsx   # Layer visibility controls
│   ├── LegendPanel.tsx        # Map legend
│   └── TitleOverlay.tsx       # Top-left title card
├── layers/
│   ├── shippingLanes.ts       # Global lane PathLayer
│   ├── corridors.ts           # ASEAN corridor glow + core layers
│   ├── ports.ts               # Port ScatterplotLayer
│   ├── tradeArcs.ts           # Bilateral trade ArcLayer
│   ├── animatedVessels.ts     # rAF-animated vessel dots
│   └── globeEvents.ts         # Pulsing event rings + dots
├── hooks/
│   ├── useVesselAnimation.ts  # Vessel position interpolation
│   ├── useEventPulse.ts       # 0→1 pulse cycle for ring animation
│   └── usePolymarketEvents.ts # Event data hook
├── data/
│   ├── globe-events.json      # 25 ASEAN geopolitical events
│   ├── corridors.json         # 10 trade corridors with narratives
│   ├── ports.json             # Port nodes with TEU data
│   ├── trade-arcs.json        # Bilateral trade flow data
│   └── ...
└── types/
    └── index.ts               # Shared TypeScript interfaces
public/
├── shipping_lanes.json        # Full global shipping lane GeoJSON
└── shipping_lanes_stitched.json
```

## Data Sources

All data is curated static JSON optimized for visualization and storytelling. No live API dependencies.

- **Shipping lanes** — Derived from Global Fishing Watch AIS density data patterns
- **Ports** — 2023 TEU throughput approximations for major ASEAN and partner ports
- **Trade corridors** — Curated ASEAN trade routes with commodity intelligence narratives
- **Geopolitical events** — 25 ASEAN-focused scenarios with probability estimates

## Architecture Notes

- `_GlobeView` from `@deck.gl/core` is an experimental API; it is cast as `any` to work around TypeScript constructor limitations
- No MapLibre basemap is used on the globe — country fills and borders are rendered via `GeoJsonLayer` using Natural Earth GeoJSON from the deck.gl CDN
- Event rings use 3 rings per event at 120° phase offsets, scaling from 80k to 480k meters radius
- Vessel animation runs on `requestAnimationFrame` via a custom hook, returning interpolated coordinates along lane paths
