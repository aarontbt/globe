import { useState, useCallback, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { _GlobeView } from "@deck.gl/core";

import corridorsData from "../data/corridors.json";
import portsData from "../data/ports.json";
import tradeArcsData from "../data/trade-arcs.json";
import iranIntelEvents from "../data/iran-intel-events.json";
import { createGlobalShippingLanesLayer } from "../layers/shippingLanes";
import { createCorridorLayers } from "../layers/corridors";
import { createPortsLayer } from "../layers/ports";
import { createTradeArcsLayer } from "../layers/tradeArcs";
import { createAnimatedVesselsLayer } from "../layers/animatedVessels";
import { createEventRingsLayer, createEventDotsLayer } from "../layers/globeEvents";
import { createAircraftLayer } from "../layers/aircraft";
import { createSatellitesLayer } from "../layers/satellites";
import { createCountryLabelsLayer } from "../layers/countryLabels";
import { useVesselAnimation } from "../hooks/useVesselAnimation";
import { useEventPulse } from "../hooks/useEventPulse";
import { usePolymarketEvents } from "../hooks/usePolymarketEvents";
import { useAdsb } from "../hooks/useAdsb";
import { useSatellites } from "../hooks/useSatellites";
import { useCountryLabels } from "../hooks/useCountryLabels";

import EventPanel from "./EventPanel";
import LayerTogglePanel from "./LayerTogglePanel";
import PerformanceMonitor from "./PerformanceMonitor";
import DataSources from "./DataSources";
import MarketsWidget from "./MarketsWidget";
import NewsWidget from "./NewsWidget";
import { useMarkets } from "../hooks/useMarkets";
import { useNews } from "../hooks/useNews";
import type { LayerVisibility } from "./LayerTogglePanel";

import type { GlobeEvent, EventCategory, Corridor, Port, TradeArc, Aircraft, Satellite } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GLOBE_VIEW = new (_GlobeView as any)({ id: "globe", controller: true });

const INITIAL_VIEW_STATE = {
  longitude: 115,
  latitude: 5,
  zoom: 3,
  minZoom: 0.3,
  maxZoom: 5,
};

const COUNTRIES_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson";
const OCEAN_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_ocean.geojson";

const ALL_CATEGORIES: EventCategory[] = [
  "security", "political", "economic", "climate", "election", "diplomatic",
];

export default function GlobeView() {
  const pulse = useEventPulse(0.5);
  const vessels = useVesselAnimation();
  const { quotes, loading: marketsLoading, lastUpdated: marketsUpdated } = useMarkets();
  const { articles, loading: newsLoading, cacheAge, refresh: refreshNews } = useNews();

  const { events: polymarketEvents, loading: eventsLoading, error: eventsError } = usePolymarketEvents();
  const events = useMemo(
    () => [...polymarketEvents, ...(iranIntelEvents as GlobeEvent[])],
    [polymarketEvents]
  );
  const corridors = corridorsData as Corridor[];
  const ports = portsData as Port[];
  const arcs = tradeArcsData as TradeArc[];

  // Deck.gl render timing — written by onBeforeRender/onAfterRender, read by PerformanceMonitor
  const deckRenderStartRef = useRef(0);
  const deckRenderMsRef = useRef(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [visibility, setVisibility] = useState<LayerVisibility>(() => {
    const defaults: LayerVisibility = {
      showLanes: true,
      showCorridors: true,
      showPorts: true,
      showArcs: true,
      showVessels: true,
      showEvents: true,
      showAircraft: false,
      showSatellites: false,
    };
    try {
      const saved = localStorage.getItem("gfw:layerVisibility");
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });

  const handleVisibilityChange = useCallback((key: keyof LayerVisibility, val: boolean) => {
    setVisibility(prev => {
      const next = { ...prev, [key]: val };
      try { localStorage.setItem("gfw:layerVisibility", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toggleCategory = useCallback((cat: EventCategory) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const { aircraft } = useAdsb(visibility.showAircraft);
  const { satellites } = useSatellites(visibility.showSatellites);
  const countryLabels = useCountryLabels();

  // Coarse camera position — only updates when lon/lat change by ≥3°, so labels
  // don't trigger a layer rebuild on every animation frame while panning
  const [labelCam, setLabelCam] = useState({
    lon: INITIAL_VIEW_STATE.longitude,
    lat: INITIAL_VIEW_STATE.latitude,
  });
  const labelCamRef = useRef(labelCam);

  const handleViewStateChange = useCallback(({ viewState: vs }: any) => {
    const lon = Math.round(vs.longitude / 3) * 3;
    const lat = Math.round(vs.latitude  / 3) * 3;
    if (lon !== labelCamRef.current.lon || lat !== labelCamRef.current.lat) {
      labelCamRef.current = { lon, lat };
      setLabelCam({ lon, lat });
    }
  }, []);

  // Filter to labels whose centroid is within 75° of the camera centre.
  // The globe horizon is at 90° — the 15° margin ensures billboard text
  // never reaches the limb where _GlobeView stencil-clips it.
  const visibleLabels = useMemo(() => {
    if (countryLabels.length === 0) return [];
    const camLon = labelCam.lon * (Math.PI / 180);
    const camLat = labelCam.lat * (Math.PI / 180);
    const MAX_ANGLE = 75 * (Math.PI / 180);
    return countryLabels.filter(({ coordinates: [lo, la] }) => {
      const lon = lo * (Math.PI / 180);
      const lat = la * (Math.PI / 180);
      const dot =
        Math.sin(camLat) * Math.sin(lat) +
        Math.cos(camLat) * Math.cos(lat) * Math.cos(lon - camLon);
      return Math.acos(Math.max(-1, Math.min(1, dot))) < MAX_ANGLE;
    });
  }, [countryLabels, labelCam]);

  // Static layers — only rebuilt when visibility/data changes, not every animation frame
  const staticLayers = useMemo(() => {
    const result: any[] = [
      // Base globe — ocean fill
      new GeoJsonLayer({
        id: "ocean",
        data: OCEAN_URL,
        filled: true,
        getFillColor: [15, 30, 80, 255],
        stroked: false,
        pickable: false,
        parameters: { depthTest: true, depthMask: true },
      }),
      // Country fill + borders
      new GeoJsonLayer({
        id: "countries",
        data: COUNTRIES_URL,
        filled: true,
        getFillColor: [8, 14, 28, 255],
        stroked: true,
        getLineColor: [80, 130, 200, 110],
        getLineWidth: 0.8,
        lineWidthUnits: "pixels",
        pickable: false,
        parameters: { depthTest: true, depthMask: true },
      }),
    ];
    if (visibility.showLanes) result.push(createGlobalShippingLanesLayer());
    if (visibility.showCorridors) result.push(...createCorridorLayers(corridors));
    if (visibility.showArcs) result.push(createTradeArcsLayer(arcs));
    if (visibility.showPorts) result.push(createPortsLayer(ports));
    return result;
  }, [visibility.showLanes, visibility.showCorridors, visibility.showArcs, visibility.showPorts, corridors, ports, arcs]);

  // Label layer — separate memo so staticLayers doesn't rebuild on camera move
  const labelLayer = useMemo(
    () => createCountryLabelsLayer(visibleLabels),
    [visibleLabels]
  );

  // High-frequency animated layers — rebuilds every animation tick (pulse changes at ~33Hz)
  const pulseLayers = useMemo(() => {
    const result: any[] = [];
    if (visibility.showVessels) result.push(createAnimatedVesselsLayer(vessels));
    if (visibility.showEvents) {
      result.push(createEventRingsLayer(events, pulse, activeCategories));
      result.push(createEventDotsLayer(events, activeCategories, selectedId));
    }
    return result;
  }, [pulse, activeCategories, selectedId, visibility.showVessels, visibility.showEvents, vessels, events]);

  // Low-frequency layers — only rebuilds when aircraft/satellite data changes (60s / 20s)
  const liveTrackingLayers = useMemo(() => {
    const result: any[] = [];
    if (visibility.showAircraft) result.push(createAircraftLayer(aircraft));
    if (visibility.showSatellites) result.push(createSatellitesLayer(satellites));
    return result;
  }, [visibility.showAircraft, visibility.showSatellites, aircraft, satellites]);

  const layers = useMemo(
    () => [...staticLayers, labelLayer, ...pulseLayers, ...liveTrackingLayers],
    [staticLayers, labelLayer, pulseLayers, liveTrackingLayers]
  );

  const getTooltip = useCallback(({ object, layer }: any) => {
    if (!object) return null;

    if (layer?.id === "event-dots") {
      const evt = object as GlobeEvent;
      return {
        html: `<div style="font-family:system-ui;padding:2px 0;max-width:240px">
          <div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:4px">${evt.title}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5)">${evt.country} · ${evt.region}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px">${evt.probability}% probability</div>
        </div>`,
        style: {
          backgroundColor: "rgba(8,12,22,0.92)",
          borderRadius: "8px",
          padding: "8px 12px",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(8px)",
        },
      };
    }

    if (layer?.id === "ports") {
      const p = object as Port;
      const typeLabel = p.type === "asean" ? "ASEAN" : p.type === "partner" ? "Partner" : "Global";
      const typeColor = p.type === "asean" ? "#00ffc8" : p.type === "partner" ? "#ffc800" : "#ff7832";
      return {
        html: `<div style="font-family:system-ui;padding:4px 0;min-width:200px">
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px">
            <span style="font-weight:700;font-size:14px;color:#fff">${p.name}</span>
            <span style="font-size:11px;font-weight:600;color:${typeColor};background:${typeColor}22;padding:1px 6px;border-radius:4px">#${p.rank} WORLD</span>
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:6px">${p.country} · ${typeLabel}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em">Throughput</div>
              <div style="font-size:13px;color:#0ff;font-weight:600">${(p.teu / 1000).toFixed(1)}M TEU/yr</div>
            </div>
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em">Depth</div>
              <div style="font-size:13px;color:#a78bfa;font-weight:600">${p.depth}m</div>
            </div>
          </div>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">
            <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Operator</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.8)">${p.operator}</div>
          </div>
        </div>`,
        style: {
          backgroundColor: "rgba(0,0,0,0.9)",
          borderRadius: "10px",
          padding: "10px 14px",
          border: "1px solid rgba(255,255,255,0.12)",
        },
      };
    }

    if (layer?.id === "trade-arcs") {
      const a = object as TradeArc;
      return {
        html: `<div style="font-family:system-ui;padding:4px 0">
          <div style="font-weight:600;font-size:14px;color:#fff">${a.from} → ${a.to}</div>
          <div style="font-size:13px;color:rgb(${a.color.join(",")});margin-top:2px">$${a.valueBn}B bilateral trade</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px">${a.commodity}</div>
        </div>`,
        style: {
          backgroundColor: "rgba(0,0,0,0.85)",
          borderRadius: "8px",
          padding: "10px 14px",
          border: "1px solid rgba(255,255,255,0.1)",
        },
      };
    }

    if (layer?.id === "aircraft-dots") {
      const a = object as Aircraft;
      const altFt = Math.round(a.altitudeM * 3.281);
      const speedKt = Math.round(a.velocityMs * 1.944);
      return {
        html: `<div style="font-family:system-ui;padding:2px 0;min-width:160px">
          <div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:3px">${a.callsign || a.icao24}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:6px">${a.country}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px">
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em">Altitude</div>
              <div style="font-size:12px;color:#fff;font-weight:600">${altFt.toLocaleString()} ft</div>
            </div>
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em">Speed</div>
              <div style="font-size:12px;color:#fff;font-weight:600">${speedKt} kt</div>
            </div>
          </div>
        </div>`,
        style: {
          backgroundColor: "rgba(8,12,22,0.92)",
          borderRadius: "8px",
          padding: "8px 12px",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(8px)",
        },
      };
    }

    if (layer?.id === "satellites") {
      const s = object as Satellite;
      return {
        html: `<div style="font-family:system-ui;padding:2px 0;min-width:160px">
          <div style="font-weight:700;font-size:13px;color:#00ffdc;margin-bottom:3px">${s.name}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;margin-top:4px">
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em">Altitude</div>
              <div style="font-size:12px;color:#fff;font-weight:600">${Math.round(s.altitudeKm)} km</div>
            </div>
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em">Period</div>
              <div style="font-size:12px;color:#fff;font-weight:600">${s.periodMin.toFixed(1)} min</div>
            </div>
          </div>
        </div>`,
        style: {
          backgroundColor: "rgba(0,20,20,0.92)",
          borderRadius: "8px",
          padding: "8px 12px",
          border: "1px solid rgba(0,255,220,0.2)",
          backdropFilter: "blur(8px)",
        },
      };
    }

    if (layer?.id === "corridors-core" || layer?.id === "corridors-glow") {
      const c = object.properties as Corridor;
      return {
        html: `<div style="font-family:system-ui;padding:4px 0;max-width:280px">
          <div style="font-weight:600;font-size:14px;color:#fff">${c.name}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px">${c.commodity} · Vol ${c.volume}/10</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;line-height:1.4">${c.narrative}</div>
        </div>`,
        style: {
          backgroundColor: "rgba(0,0,0,0.85)",
          borderRadius: "8px",
          padding: "10px 14px",
          border: "1px solid rgba(255,255,255,0.1)",
        },
      };
    }

    return null;
  }, []);

  const handleClick = useCallback(({ object, layer }: any) => {
    if (layer?.id === "event-dots" && object) {
      setSelectedId((prev: string | null) =>
        prev === (object as GlobeEvent).id ? null : (object as GlobeEvent).id
      );
    } else if (!object) {
      setSelectedId(null);
    }
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "radial-gradient(ellipse at center, #06091a 0%, #020408 100%)",
      }}
    >
      {/* Star field background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 10% 85%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 40% 55%, rgba(255,255,255,0.1) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 75% 45%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 50% 20%, rgba(255,255,255,0.2) 0%, transparent 100%)
          `,
          pointerEvents: "none",
        }}
      />

      <DeckGL
        views={GLOBE_VIEW}
        initialViewState={INITIAL_VIEW_STATE}
        layers={layers}
        getTooltip={getTooltip}
        onClick={handleClick}
        onViewStateChange={handleViewStateChange}
        style={{ width: "100%", height: "100%" }}
        {...{
          onBeforeRender: () => { deckRenderStartRef.current = performance.now(); },
          onAfterRender:  () => { deckRenderMsRef.current = performance.now() - deckRenderStartRef.current; },
        } as any}
      />

      {/* Left column — title + markets + news, pinned top-to-bottom, no outer scroll */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          bottom: 16,
          zIndex: 10,
          width: 280,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Title card */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            pointerEvents: "none",
            flexShrink: 0,
          }}
        >
          <div style={{
            background: "rgba(10,14,23,0.88)",
            backdropFilter: "blur(12px)",
            borderRadius: 12,
            padding: "12px 16px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
              ASEAN Intelligence
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
              Shipping · Trade · Geopolitical Events
            </div>

            {/* Event legend — 2-column grid */}
            <div style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "5px 4px",
            }}>
              {[
                { color: "#ef4444", label: "Security" },
                { color: "#a855f7", label: "Political" },
                { color: "#22d3ee", label: "Economic" },
                { color: "#4ade80", label: "Climate" },
                { color: "#fb923c", label: "Election" },
                { color: "#fbbf24", label: "Diplomatic" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 5px ${color}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Markets widget */}
        <div style={{ flexShrink: 0 }}>
          <MarketsWidget quotes={quotes} loading={marketsLoading} lastUpdated={marketsUpdated} />
        </div>

        {/* News widget — fills remaining height, scrolls internally */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <NewsWidget articles={articles} loading={newsLoading} cacheAge={cacheAge} onRefresh={refreshNews} />
        </div>
      </div>

      {/* Event panel */}
      {visibility.showEvents && (
        <EventPanel
          events={events}
          loading={eventsLoading}
          error={eventsError}
          selectedId={selectedId}
          activeCategories={activeCategories}
          onSelect={setSelectedId}
          onToggleCategory={toggleCategory}
        />
      )}

      {/* Top-right controls: layers + perf, left of EventPanel */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 344,
          zIndex: 10,
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <LayerTogglePanel
          visibility={visibility}
          onChange={handleVisibilityChange}
        />
        <DataSources />
        <PerformanceMonitor deckRenderMsRef={deckRenderMsRef} />
      </div>
    </div>
  );
}
