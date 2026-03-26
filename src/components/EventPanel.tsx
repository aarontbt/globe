import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobeEvent, EventCategory, SocialPlatform } from "../types";
import { CATEGORY_COLORS } from "../layers/globeEvents";
import { FONT_SANS } from "../styles/fonts";

const ALL_CATEGORIES: EventCategory[] = [
  "security", "political", "economic", "climate", "election", "diplomatic", "social",
];

const CATEGORY_LABELS: Record<EventCategory, string> = {
  security:   "Security",
  political:  "Political",
  economic:   "Economic",
  climate:    "Climate",
  election:   "Election",
  diplomatic: "Diplomatic",
  social:     "Social",
};

const CATEGORY_ABBREV: Record<EventCategory, string> = {
  security:   "SEC",
  political:  "POL",
  economic:   "ECO",
  climate:    "CLM",
  election:   "ELX",
  diplomatic: "DIP",
  social:     "SOC",
};

const IMPACT_BADGE: Record<string, { label: string; color: string }> = {
  high:   { label: "HIGH IMPACT",   color: "#ef4444" },
  medium: { label: "MED IMPACT",    color: "#f59e0b" },
  low:    { label: "LOW IMPACT",    color: "#6b7280" },
};

function toRgba(rgb: [number, number, number], a = 1) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}


const PLATFORM_META: Record<SocialPlatform, { label: string; color: string; icon: string }> = {
  gdelt:   { label: "GDELT",    color: "#7c3aed", icon: "📡" },
  acled:   { label: "ACLED",    color: "#dc2626", icon: "⚔️" },
  reddit:  { label: "REDDIT",   color: "#f97316", icon: "💬" },
  bluesky: { label: "BLUESKY",  color: "#3b82f6", icon: "🦋" },
};

function SocialStrip({ event }: { event: GlobeEvent }) {
  const s = event.social;
  if (!s) return null;
  const meta = PLATFORM_META[s.platform];
  return (
    <div style={{
      marginTop: 10,
      padding: "8px 10px",
      borderRadius: 8,
      background: `${meta.color}11`,
      border: `1px solid ${meta.color}33`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 11 }}>{meta.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: "0.08em" }}>
            {meta.label}
          </span>
        </div>
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: 10,
            color: `${meta.color}bb`,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          View source
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </a>
      </div>
      <div style={{ display: "flex", gap: 0 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{s.engagement.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{s.engagementLabel}</div>
        </div>
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

      {event.probability !== undefined && <ProbabilityBar value={event.probability} color={color} />}

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

          {event.social && <SocialStrip event={event} />}

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
      title={CATEGORY_LABELS[category]}
      style={{
        padding: "3px 7px",
        borderRadius: 20,
        border: `1px solid ${active ? toRgba(color, 0.6) : "rgba(255,255,255,0.10)"}`,
        background: active ? toRgba(color, 0.15) : "transparent",
        color: active ? toRgba(color) : "rgba(255,255,255,0.35)",
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 3,
        transition: "all 0.15s",
        letterSpacing: "0.06em",
      }}
    >
      <span style={{
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: active ? toRgba(color) : "rgba(255,255,255,0.18)",
        flexShrink: 0,
      }} />
      {CATEGORY_ABBREV[category]}
      <span style={{
        background: active ? toRgba(color, 0.22) : "rgba(255,255,255,0.07)",
        padding: "0 3px",
        borderRadius: 8,
        fontSize: 9,
        fontWeight: 600,
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
  const [sortMode, setSortMode] = useState<"probability" | "date">(() => {
    try {
      const saved = localStorage.getItem("gb:eventSort");
      return saved === "date" ? "date" : "probability";
    } catch { return "probability"; }
  });

  const [hidePriced, setHidePriced] = useState<boolean>(() => {
    try { return localStorage.getItem("gb:hidePriced") === "1"; } catch { return false; }
  });

  const PRICED_IN_THRESHOLD = 85;

  useEffect(() => {
    if (!selectedId) return;
    const card = document.getElementById(`event-card-${selectedId}`);
    if (card && scrollRef.current) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<EventCategory, number>> = {};
    for (const e of events) {
      if (!e.id.startsWith("pm-")) counts[e.category] = (counts[e.category] ?? 0) + 1;
    }
    return counts;
  }, [events]);

  const sorted = useMemo(
    () =>
      events
        .filter(e => !e.id.startsWith("pm-"))
        .filter(e => activeCategories.has(e.category))
        .filter(e => !hidePriced || (e.probability ?? 0) < PRICED_IN_THRESHOLD)
        .sort((a, b) =>
          sortMode === "date"
            ? b.date.localeCompare(a.date)
            : (b.probability ?? -1) - (a.probability ?? -1)
        ),
    [events, activeCategories, sortMode, hidePriced]
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        fontFamily: FONT_SANS,
      }}
    >
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding: "10px 14px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
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

        {/* Sort toggle + priced-in filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Sort
          </span>
          <div style={{
            display: "flex",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: 2,
            gap: 2,
          }}>
            {(["probability", "date"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setSortMode(mode);
                  try { localStorage.setItem("gb:eventSort", mode); } catch {}
                }}
                style={{
                  padding: "2px 9px",
                  borderRadius: 16,
                  border: "none",
                  background: sortMode === mode ? "rgba(255,255,255,0.12)" : "transparent",
                  color: sortMode === mode ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  transition: "all 0.15s",
                }}
              >
                {mode === "probability" ? "Prob ↓" : "Date ↓"}
              </button>
            ))}
          </div>
          <div style={{
            display: "flex",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: 2,
          }}>
            <button
              onClick={() => {
                const next = !hidePriced;
                setHidePriced(next);
                try { localStorage.setItem("gb:hidePriced", next ? "1" : "0"); } catch {}
              }}
              title={`${hidePriced ? "Show" : "Hide"} events ≥${PRICED_IN_THRESHOLD}% (priced in)`}
              style={{
                padding: "2px 9px",
                borderRadius: 16,
                border: "none",
                background: hidePriced ? "rgba(255,255,255,0.12)" : "transparent",
                color: hidePriced ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {`≥${PRICED_IN_THRESHOLD}% ${hidePriced ? "hidden" : "shown"}`}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable event list */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: "auto",
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

    </div>
  );
}
