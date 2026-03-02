import { useState } from "react";

interface DataSource {
  name: string;
  type: "live" | "static";
  description: string;
  detail: string;
  color: string;
}

const DATA_SOURCES: DataSource[] = [
  {
    name: "Polymarket",
    type: "live",
    description: "Prediction Markets",
    detail:
      "Live crowd-sourced prediction markets filtered for ASEAN & global geopolitical events. Provides probability scores for conflict, election, and political risk.",
    color: "#22d3ee",
  },
  {
    name: "Yahoo Finance",
    type: "live",
    description: "Commodity Prices",
    detail:
      "Real-time Brent Crude (BZ=F), WTI Crude (CL=F), and Gold (GC=F) spot prices. Refreshes every 60s with Stooq as fallback.",
    color: "#34d399",
  },
  {
    name: "CNA / BBC RSS",
    type: "live",
    description: "News Feeds",
    detail:
      "RSS headlines from Channel News Asia and BBC filtered by keywords: iran, oil, asean, hormuz, trade, shipping, energy, sanctions, crude, tanker. Cached 15 min.",
    color: "#f59e0b",
  },
  {
    name: "OpenSky Network",
    type: "live",
    description: "Aircraft Tracking",
    detail:
      "Real-time global ADS-B flight states (ICAO24, callsign, altitude, velocity, heading) covering all transponder-equipped aircraft. Updates every 60s.",
    color: "#a78bfa",
  },
  {
    name: "CelesTrak",
    type: "live",
    description: "Satellite TLEs",
    detail:
      "Two-line element sets for 500 active satellites in LEO/MEO/GEO. Propagated to current positions using satellite.js. TLEs refresh every 10 min.",
    color: "#fb923c",
  },
  {
    name: "Natural Earth CDN",
    type: "live",
    description: "Globe Basemap",
    detail:
      "Country polygons, ocean fill, and centroid label data served via Deck.GL CloudFront CDN. Renders the globe basemap and country name overlays.",
    color: "#64748b",
  },
  {
    name: "Ports DB",
    type: "static",
    description: "Shipping Ports",
    detail:
      "Curated global ports dataset with TEU throughput rankings, terminal operators, and vessel draft depths. Classified as ASEAN, partner, or global tier.",
    color: "#38bdf8",
  },
  {
    name: "Trade Corridors",
    type: "static",
    description: "Corridor Routes",
    detail:
      "Major and secondary shipping corridor geometries annotated with commodity type, annual tonnage volume, and strategic narrative context.",
    color: "#4ade80",
  },
  {
    name: "Trade Arcs",
    type: "static",
    description: "Trade Flows",
    detail:
      "Bilateral trade flow arcs between regions showing USD value (billions) and primary commodity for each directional relationship.",
    color: "#f472b6",
  },
  {
    name: "Globe Events",
    type: "static",
    description: "Geo-intel Events",
    detail:
      "25 curated ASEAN geopolitical events with impact probability, category (security, political, economic, climate, election, diplomatic), and Polymarket linkage.",
    color: "#fbbf24",
  },
  {
    name: "Iran Intel",
    type: "static",
    description: "Iran Threat Layer",
    detail:
      "Strait of Hormuz flashpoints, energy crisis signals, and sanctions-related intelligence events. Overlaid alongside Polymarket and globe events data.",
    color: "#ef4444",
  },
  {
    name: "Lane Paths",
    type: "static",
    description: "Vessel Routes",
    detail:
      "Predefined waypoint arrays for major and secondary shipping lanes. Used to animate 130 virtual vessels distributed across global maritime corridors.",
    color: "#94a3b8",
  },
];

const LIVE_SOURCES = DATA_SOURCES.filter((s) => s.type === "live");
const STATIC_SOURCES = DATA_SOURCES.filter((s) => s.type === "static");

function SourceRow({ source }: { source: DataSource }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 7px",
          borderRadius: 6,
          background: hovered ? "rgba(255,255,255,0.04)" : "transparent",
          cursor: "default",
          transition: "background 0.15s",
        }}
      >
        {/* Color dot — pulses for live sources */}
        <div style={{ position: "relative", flexShrink: 0, width: 7, height: 7 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: source.color,
              opacity: 0.9,
            }}
          />
          {source.type === "live" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: source.color,
                animation: "datasources-pulse 2s ease-out infinite",
                opacity: 0.5,
              }}
            />
          )}
        </div>

        {/* Name */}
        <span
          style={{
            fontSize: 11,
            color: hovered ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.5)",
            flex: 1,
            transition: "color 0.15s",
            letterSpacing: "0.02em",
          }}
        >
          {source.name}
        </span>

        {/* Description label */}
        <span
          style={{
            fontSize: 9,
            color: hovered ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
            letterSpacing: "0.04em",
            transition: "color 0.15s",
            flexShrink: 0,
          }}
        >
          {source.description}
        </span>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            left: "calc(100% + 8px)",
            top: 0,
            zIndex: 100,
            width: 220,
            background: "rgba(4,7,16,0.97)",
            border: `1px solid ${source.color}33`,
            borderRadius: 8,
            padding: "9px 11px",
            pointerEvents: "none",
            boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px ${source.color}22`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: source.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: source.color,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {source.name}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 8,
                letterSpacing: "0.12em",
                color: source.type === "live" ? "#22d3ee" : "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
                border: `1px solid ${source.type === "live" ? "#22d3ee33" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 3,
                padding: "1px 4px",
              }}
            >
              {source.type === "live" ? "live" : "static"}
            </span>
          </div>
          <p
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {source.detail}
          </p>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 3,
        marginTop: 4,
      }}
    >
      <span
        style={{
          fontSize: 8,
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.2)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

export default function DataSources() {
  const [expanded, setExpanded] = useState(false);

  const panelBase: React.CSSProperties = {
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  if (!expanded) {
    return (
      <div style={panelBase}>
        <style>{`
          @keyframes datasources-pulse {
            0%   { transform: scale(1);   opacity: 0.5; }
            70%  { transform: scale(2.4); opacity: 0; }
            100% { transform: scale(2.4); opacity: 0; }
          }
        `}</style>
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: "rgba(8,12,22,0.88)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "5px 11px",
            color: "rgba(255,255,255,0.45)",
            fontSize: 10,
            letterSpacing: "0.16em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            backdropFilter: "blur(12px)",
          }}
        >
          <span style={{ color: "#34d399", fontSize: 8, lineHeight: 1 }}>◈</span>
          DATA
        </button>
      </div>
    );
  }

  return (
    <div style={panelBase}>
      <style>{`
        @keyframes datasources-pulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          70%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
      <div
        style={{
          background: "rgba(6,9,18,0.93)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 12,
          padding: "12px 14px",
          backdropFilter: "blur(18px)",
          width: 258,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "#34d399", fontSize: 9 }}>◈</span>
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
              }}
            >
              Data Sources
            </span>
            <span
              style={{
                fontSize: 8,
                color: "rgba(255,255,255,0.2)",
                letterSpacing: "0.04em",
              }}
            >
              {DATA_SOURCES.length} feeds
            </span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.25)",
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Live sources */}
        <SectionLabel label="Live APIs" />
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {LIVE_SOURCES.map((s) => (
            <SourceRow key={s.name} source={s} />
          ))}
        </div>

        {/* Static sources */}
        <div style={{ marginTop: 8 }}>
          <SectionLabel label="Static Data" />
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {STATIC_SOURCES.map((s) => (
              <SourceRow key={s.name} source={s} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#22d3ee",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.04em" }}>
              Live
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.04em" }}>
              Static
            </span>
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.13)", marginLeft: "auto" }}>
            hover to inspect
          </span>
        </div>
      </div>
    </div>
  );
}
