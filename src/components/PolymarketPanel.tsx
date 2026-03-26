import { useState, useMemo } from "react";
import type { GlobeEvent, EventCategory } from "../types";
import { CATEGORY_COLORS } from "../layers/globeEvents";
import { FONT_SANS } from "../styles/fonts";

function toRgba(rgb: [number, number, number], a = 1) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  security:   "Security",
  political:  "Political",
  economic:   "Economic",
  climate:    "Climate",
  election:   "Election",
  diplomatic: "Diplomatic",
  social:     "Social",
};

function ProbabilityBar({ value, color }: { value: number; color: [number,number,number] }) {
  return (
    <div style={{ margin: "8px 0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Market probability
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: toRgba(color) }}>
          {value}%
        </span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${value}%`,
          background: `linear-gradient(90deg, ${toRgba(color, 0.5)}, ${toRgba(color)})`,
          borderRadius: 4,
          transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

function MarketCard({ event, isSelected, onSelect }: {
  event: GlobeEvent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = CATEGORY_COLORS[event.category];
  const pm = event.polymarket;

  return (
    <div
      onClick={onSelect}
      style={{
        padding: "11px 13px",
        marginBottom: 7,
        borderRadius: 10,
        cursor: "pointer",
        background: isSelected
          ? `linear-gradient(135deg, rgba(100,220,120,0.08), rgba(255,255,255,0.03))`
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${isSelected ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.07)"}`,
        transition: "all 0.15s",
      }}
    >
      {/* Title */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", lineHeight: 1.35, marginBottom: 6 }}>
        {event.title}
      </div>

      {/* Category + country */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 2 }}>
        <span style={{
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 20,
          background: toRgba(color, 0.15),
          color: toRgba(color),
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}>
          {CATEGORY_LABELS[event.category]}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: "20px" }}>
          {event.country}
        </span>
      </div>

      {/* Probability bar */}
      {event.probability !== undefined && (
        <ProbabilityBar value={event.probability} color={color} />
      )}

      {/* Always-visible stats + link */}
      {pm && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginTop: 8,
          padding: "6px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          {/* Polymarket logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8, flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#00C853" fillOpacity="0.15" stroke="#00C853" strokeWidth="1.5"/>
              <path d="M7 12.5l3.5 3.5L17 8" stroke="#00C853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {[
            { label: "Vol", value: pm.volume },
            { label: "Liq", value: pm.liquidity },
            { label: "Cmt", value: pm.comments.toLocaleString() },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              flex: 1,
              textAlign: "center",
              borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              padding: "0 4px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{label}</div>
            </div>
          ))}

          <a
            href={`https://polymarket.com/event/${pm.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              marginLeft: 8,
              fontSize: 10,
              color: "rgba(74,222,128,0.65)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 3,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            Open
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </a>
        </div>
      )}

      {/* Expanded description */}
      {isSelected && event.description && (
        <div style={{
          marginTop: 9,
          paddingTop: 9,
          borderTop: "1px solid rgba(255,255,255,0.07)",
          fontSize: 11,
          lineHeight: 1.55,
          color: "rgba(255,255,255,0.55)",
        }}>
          {event.description}
        </div>
      )}
    </div>
  );
}

interface PolymarketPanelProps {
  events: GlobeEvent[];
  loading?: boolean;
  error?: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function PolymarketPanel({
  events,
  loading = false,
  error = null,
  selectedId,
  onSelect,
}: PolymarketPanelProps) {
  const [sortMode, setSortMode] = useState<"probability" | "volume">("probability");

  const sorted = useMemo(() => {
    const withPm = events.filter(e => e.polymarket);
    return [...withPm].sort((a, b) => {
      if (sortMode === "volume") {
        const volA = parseFloat((a.polymarket?.volume ?? "$0").replace(/[$,MK]/g, "")) *
          (a.polymarket?.volume.includes("M") ? 1e6 : a.polymarket?.volume.includes("K") ? 1e3 : 1);
        const volB = parseFloat((b.polymarket?.volume ?? "$0").replace(/[$,MK]/g, "")) *
          (b.polymarket?.volume.includes("M") ? 1e6 : b.polymarket?.volume.includes("K") ? 1e3 : 1);
        return volB - volA;
      }
      return (b.probability ?? -1) - (a.probability ?? -1);
    });
  }, [events, sortMode]);

  const totalVol = useMemo(() => {
    let total = 0;
    for (const e of events) {
      if (!e.polymarket) continue;
      const v = e.polymarket.volume;
      const num = parseFloat(v.replace(/[$,]/g, ""));
      if (v.includes("M")) total += num * 1e6;
      else if (v.includes("K")) total += num * 1e3;
      else total += num;
    }
    return total >= 1e6 ? `$${(total / 1e6).toFixed(1)}M` : `$${(total / 1e3).toFixed(0)}K`;
  }, [events]);

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      fontFamily: FONT_SANS,
    }}>
      {/* Sub-header */}
      <div style={{
        flexShrink: 0,
        padding: "10px 14px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Stats row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#00C853" fillOpacity="0.15" stroke="#00C853" strokeWidth="1.5"/>
              <path d="M7 12.5l3.5 3.5L17 8" stroke="#00C853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", letterSpacing: "0.08em" }}>POLYMARKET</span>
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
            {sorted.length} markets · {totalVol} vol
          </span>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: error ? "#f87171" : loading ? "rgba(255,255,255,0.3)" : "#4ade80",
            boxShadow: error ? "0 0 5px #f87171" : loading ? "none" : "0 0 5px #4ade80",
          }} />
        </div>

        {/* Sort toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Sort
          </span>
          <div style={{
            display: "flex",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20,
            padding: 2,
            gap: 2,
          }}>
            {(["probability", "volume"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                style={{
                  padding: "2px 9px",
                  borderRadius: 16,
                  border: "none",
                  background: sortMode === mode ? "rgba(255,255,255,0.10)" : "transparent",
                  color: sortMode === mode ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  transition: "all 0.15s",
                }}
              >
                {mode === "probability" ? "Prob ↓" : "Volume ↓"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable market list */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "10px 10px",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.12) transparent",
      }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 40 }}>
            Fetching Polymarket data…
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", color: "#f87171", fontSize: 12, marginTop: 40, padding: "0 16px" }}>
            {error}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 40 }}>
            No prediction markets loaded
          </div>
        ) : (
          sorted.map(evt => (
            <MarketCard
              key={evt.id}
              event={evt}
              isSelected={selectedId === evt.id}
              onSelect={() => onSelect(selectedId === evt.id ? null : evt.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
