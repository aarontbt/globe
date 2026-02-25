import { useState, useCallback, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { _GlobeView } from "@deck.gl/core";

import corridorsData from "../data/corridors.json";
import portsData from "../data/ports.json";
import tradeArcsData from "../data/trade-arcs.json";
import { createGlobalShippingLanesLayer } from "../layers/shippingLanes";
import { createCorridorLayers } from "../layers/corridors";
import { createPortsLayer } from "../layers/ports";
import { createTradeArcsLayer } from "../layers/tradeArcs";
import { createAnimatedVesselsLayer } from "../layers/animatedVessels";
import { createEventRingsLayer, createEventDotsLayer } from "../layers/globeEvents";
import { useVesselAnimation } from "../hooks/useVesselAnimation";
import { useEventPulse } from "../hooks/useEventPulse";
import { usePolymarketEvents } from "../hooks/usePolymarketEvents";

import EventPanel from "./EventPanel";
import LayerTogglePanel from "./LayerTogglePanel";
import PerformanceMonitor from "./PerformanceMonitor";
import type { LayerVisibility } from "./LayerTogglePanel";

import type { GlobeEvent, EventCategory, Corridor, Port, TradeArc } from "../types";

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

  const { events, loading: eventsLoading, error: eventsError } = usePolymarketEvents();
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
  const [visibility, setVisibility] = useState<LayerVisibility>({
    showLanes: true,
    showCorridors: true,
    showPorts: true,
    showArcs: true,
    showVessels: true,
    showEvents: true,
  });

  const toggleCategory = useCallback((cat: EventCategory) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

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

  // Animated layers — rebuilt each animation tick
  const animatedLayers = useMemo(() => {
    const result: any[] = [];
    if (visibility.showVessels) result.push(createAnimatedVesselsLayer(vessels));
    if (visibility.showEvents) {
      result.push(createEventRingsLayer(events, pulse, activeCategories));
      result.push(createEventDotsLayer(events, activeCategories, selectedId));
    }
    return result;
  }, [pulse, activeCategories, selectedId, visibility.showVessels, visibility.showEvents, vessels, events]);

  const layers = useMemo(
    () => [...staticLayers, ...animatedLayers],
    [staticLayers, animatedLayers]
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
      return {
        html: `<div style="font-family:system-ui;padding:4px 0">
          <div style="font-weight:600;font-size:14px;color:#fff">${p.name}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6)">${p.country} · ${p.type === "asean" ? "ASEAN" : "Partner"}</div>
          <div style="font-size:13px;color:#0ff;margin-top:4px">${(p.teu / 1000).toFixed(1)}M TEU/year</div>
        </div>`,
        style: {
          backgroundColor: "rgba(0,0,0,0.85)",
          borderRadius: "8px",
          padding: "10px 14px",
          border: "1px solid rgba(255,255,255,0.1)",
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
        style={{ width: "100%", height: "100%" }}
        {...{
          onBeforeRender: () => { deckRenderStartRef.current = performance.now(); },
          onAfterRender:  () => { deckRenderMsRef.current = performance.now() - deckRenderStartRef.current; },
        } as any}
      />

      {/* Globe title bar */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          fontFamily: "system-ui, -apple-system, sans-serif",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <div style={{
          background: "rgba(10,14,23,0.88)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          padding: "12px 16px",
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: 280,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
            ASEAN Maritime Intelligence
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
            Shipping · Trade · Geopolitical Events
          </div>

          {/* Event legend */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { color: "#ef4444", label: "Security" },
              { color: "#a855f7", label: "Political" },
              { color: "#22d3ee", label: "Economic" },
              { color: "#4ade80", label: "Climate" },
              { color: "#fb923c", label: "Election" },
              { color: "#fbbf24", label: "Diplomatic" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{label}</span>
              </div>
            ))}
          </div>
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

      {/* Bottom-left controls: layers + perf side by side */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          zIndex: 10,
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <LayerTogglePanel
          visibility={visibility}
          onChange={(key, val) => setVisibility(prev => ({ ...prev, [key]: val }))}
        />
        <PerformanceMonitor deckRenderMsRef={deckRenderMsRef} />
      </div>
    </div>
  );
}
