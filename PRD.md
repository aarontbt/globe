# ASEAN Maritime Intelligence — Product Requirements Document

## Overview

Interactive shipping visualization demo for Maybank advisory pitch. Differentiates from Bloomberg terminals by providing an **ASEAN-native business context layer** — curated trade corridors with narrative intelligence designed for bankers, not traders.

## Scope

Standalone single-page application. No backend, no live API calls. All data is curated static JSON optimized for storytelling in a pitch setting.

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Vite + React 18 + TypeScript |
| Map Engine | deck.gl v9 + MapLibre GL JS |
| Basemap | CARTO Dark Matter (no API key) |
| Styling | Tailwind CSS v4 |

## Data Sources & Narrative Framing

### Shipping Lanes (10 corridors)
Curated ASEAN trade corridors with volume indices (1-10) and business intelligence narratives. Includes Malacca Strait, SCS Main Corridor, Sunda/Lombok/Makassar Straits, point-to-point routes, and commodity-specific corridors (Nickel, Palm Oil).

### Ports (20 nodes)
12 ASEAN ports + 8 key trading partners. TEU throughput data approximates 2023 figures. Color-coded: teal for ASEAN, gold for partner ports.

### Trade Arcs (14 pairs)
Bilateral trade flows with USD billion values and commodity descriptions. Great-circle arcs connect port pairs with color-coded curves.

### Narrative Zones (4 regions)
Highlighted polygons with hover-triggered intelligence briefs:
- **Malacca Strait Congestion Zone** — 25-28% of global trade, insurance premium implications
- **South China Sea Corridor** — $5.3T annual trade, geopolitical risk overlay
- **Indonesia Nickel Belt** — 48% of global reserves, EV battery supply chain
- **Johor-Singapore SEZ** — $100B+ development pipeline

## Visualization Layers

1. **Shipping Lanes** — Dual PathLayer (glow + core), width scales with volume
2. **Narrative Zones** — Semi-transparent PolygonLayer, pickable for tooltips
3. **Trade Arcs** — ArcLayer with great-circle projection
4. **Ports** — ScatterplotLayer sized by √TEU
5. **Animated Vessels** — ~80 white dots moving along lanes via requestAnimationFrame

## UI Overlays

- **Title Card** — "ASEAN Maritime Intelligence" with live indicator, glass-morphism
- **Legend Panel** — Compact visual key for all layer types
- **Tooltips** — Context-sensitive on hover: port stats, trade values, zone narratives

## Build & Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Static dist/ folder
```
