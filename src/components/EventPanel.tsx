import { useEffect, useMemo, useRef } from "react";
import type { GlobeEvent, EventCategory, PolymarketData } from "../types";
import { CATEGORY_COLORS } from "../layers/globeEvents";

const ALL_CATEGORIES: EventCategory[] = [
  "security", "political", "economic", "climate", "election", "diplomatic",
];

const CATEGORY_LABELS: Record<EventCategory, string> = {
  security:   "Security",
  political:  "Political",
  economic:   "Economic",
  climate:    "Climate",
  election:   "Election",
  diplomatic: "Diplomatic",
};

const IMPACT_BADGE: Record<string, { label: string; color: string }> = {
  high:   { label: "HIGH IMPACT",   color: "#ef4444" },
  medium: { label: "MED IMPACT",    color: "#f59e0b" },
  low:    { label: "LOW IMPACT",    color: "#6b7280" },
};

function toRgba(rgb: [number, number, number], a = 1) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function PolymarketStrip({ data, slug }: { data: PolymarketData; slug: string }) {
  const url = `https://polymarket.com/event/${slug}`;
  return (
    <div style={{
      marginTop: 10,
      padding: "8px 10px",
      borderRadius: 8,
      background: "rgba(100,220,120,0.06)",
      border: "1px solid rgba(100,220,120,0.18)",
    }}>
      {/* Polymarket logo row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#00C853" fillOpacity="0.2" stroke="#00C853" strokeWidth="1.5"/>
            <path d="M7 12.5l3.5 3.5L17 8" stroke="#00C853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", letterSpacing: "0.08em" }}>
            POLYMARKET
          </span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: 10,
            color: "rgba(74,222,128,0.7)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          View market
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </a>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 0 }}>
        {[
          { label: "Volume", value: data.volume },
          { label: "Liquidity", value: data.liquidity },
          { label: "Comments", value: data.comments.toLocaleString() },
        ].map(({ label, value }, i) => (
          <div
            key={label}
            style={{
              flex: 1,
              textAlign: "center",
              borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
              padding: "0 6px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{value}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProbabilityBar({ value, color }: { value: number; color: [number,number,number] }) {
  return (
    <div style={{ margin: "12px 0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Probability
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: toRgba(color) }}>
          {value}%
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            background: `linear-gradient(90deg, ${toRgba(color, 0.6)}, ${toRgba(color)})`,
            borderRadius: 4,
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

interface EventCardProps {
  event: GlobeEvent;
  isSelected: boolean;
  onClick: () => void;
}

function EventCard({ event, isSelected, onClick }: EventCardProps) {
  const color = CATEGORY_COLORS[event.category];
  const impact = IMPACT_BADGE[event.impact];

  return (
    <div
      id={`event-card-${event.id}`}
      onClick={onClick}
      style={{
        padding: "12px 14px",
        marginBottom: 8,
        borderRadius: 10,
        cursor: "pointer",
        background: isSelected
          ? `linear-gradient(135deg, ${toRgba(color, 0.15)}, rgba(255,255,255,0.04))`
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${isSelected ? toRgba(color, 0.5) : "rgba(255,255,255,0.07)"}`,
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", lineHeight: 1.35, flex: 1 }}>
          {event.title}
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: impact.color,
          whiteSpace: "nowrap",
          letterSpacing: "0.05em",
        }}>
          {impact.label}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 20,
          background: toRgba(color, 0.18),
          color: toRgba(color),
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}>
          {CATEGORY_LABELS[event.category]}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
          {event.country}
        </span>
      </div>

      <ProbabilityBar value={event.probability} color={color} />

      {isSelected && (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          lineHeight: 1.55,
          color: "rgba(255,255,255,0.65)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 10,
        }}>
          {event.description}

          {event.polymarket && (
            <PolymarketStrip data={event.polymarket} slug={event.polymarket.slug} />
          )}

          <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
            {event.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.4)",
              }}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterButtonProps {
  category: EventCategory;
  active: boolean;
  count: number;
  onToggle: () => void;
}

function FilterButton({ category, active, count, onToggle }: FilterButtonProps) {
  const color = CATEGORY_COLORS[category];
  return (
    <button
      onClick={onToggle}
      style={{
        padding: "4px 10px",
        borderRadius: 20,
        border: `1px solid ${active ? toRgba(color, 0.6) : "rgba(255,255,255,0.12)"}`,
        background: active ? toRgba(color, 0.15) : "transparent",
        color: active ? toRgba(color) : "rgba(255,255,255,0.4)",
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        transition: "all 0.15s",
        letterSpacing: "0.03em",
      }}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: active ? toRgba(color) : "rgba(255,255,255,0.2)",
        flexShrink: 0,
      }} />
      {CATEGORY_LABELS[category]}
      <span style={{
        background: active ? toRgba(color, 0.25) : "rgba(255,255,255,0.08)",
        padding: "0 4px",
        borderRadius: 10,
        fontSize: 10,
      }}>
        {count}
      </span>
    </button>
  );
}

interface EventPanelProps {
  events: GlobeEvent[];
  loading?: boolean;
  error?: string | null;
  selectedId: string | null;
  activeCategories: Set<EventCategory>;
  onSelect: (id: string | null) => void;
  onToggleCategory: (cat: EventCategory) => void;
}

export default function EventPanel({
  events,
  loading = false,
  error = null,
  selectedId,
  activeCategories,
  onSelect,
  onToggleCategory,
}: EventPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    const card = document.getElementById(`event-card-${selectedId}`);
    if (card && scrollRef.current) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<EventCategory, number>> = {};
    for (const e of events) counts[e.category] = (counts[e.category] ?? 0) + 1;
    return counts;
  }, [events]);

  const sorted = useMemo(
    () =>
      events
        .filter(e => activeCategories.has(e.category))
        .sort((a, b) => b.probability - a.probability),
    [events, activeCategories]
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        bottom: 16,
        width: 320,
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        pointerEvents: "all",
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div style={{
        background: "rgba(10,14,23,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: "12px 12px 0 0",
        padding: "14px 16px 12px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderBottom: "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em" }}>
              EVENT INTELLIGENCE
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
              {sorted.length} active events
            </div>
          </div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: error ? "#f87171" : loading ? "rgba(255,255,255,0.4)" : "#4ade80",
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: error ? "#f87171" : loading ? "rgba(255,255,255,0.3)" : "#4ade80",
              boxShadow: error ? "0 0 6px #f87171" : loading ? "none" : "0 0 6px #4ade80",
              display: "inline-block",
            }} />
            {error ? "ERROR" : loading ? "LOADING" : "LIVE"}
          </div>
        </div>

        {/* Category filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
          {ALL_CATEGORIES.map(cat => (
            <FilterButton
              key={cat}
              category={cat}
              active={activeCategories.has(cat)}
              count={categoryCounts[cat] ?? 0}
              onToggle={() => onToggleCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* Scrollable event list */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: "auto",
        background: "rgba(10,14,23,0.88)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTop: "none",
        borderBottom: "none",
        padding: "10px 12px",
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
            No events in selected categories
          </div>
        ) : (
          sorted.map(evt => (
            <EventCard
              key={evt.id}
              event={evt}
              isSelected={selectedId === evt.id}
              onClick={() => onSelect(selectedId === evt.id ? null : evt.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: "rgba(10,14,23,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: "0 0 12px 12px",
        padding: "10px 16px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
          Click event on globe or card to expand
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
          % = Polymarket YES price
        </span>
      </div>
    </div>
  );
}
