import type { GlobeEvent, EventCategory } from "../types";
import { FONT_SANS } from "../styles/fonts";
import EventPanel from "./EventPanel";
import PolymarketPanel from "./PolymarketPanel";
import CommoditiesImpactPanel from "./CommoditiesImpactPanel";

export type RightPanelTab = "events" | "predictions" | "supply-chain";

const TABS: { id: RightPanelTab; label: string }[] = [
  { id: "events",       label: "EVENTS" },
  { id: "predictions",  label: "PREDICTIONS" },
  { id: "supply-chain", label: "SUPPLY CHAIN" },
];

interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  // EventPanel props
  intelEvents: GlobeEvent[];
  polymarketEvents: GlobeEvent[];
  eventsLoading?: boolean;
  eventsError?: string | null;
  selectedId: string | null;
  activeCategories: Set<EventCategory>;
  onSelect: (id: string | null) => void;
  onToggleCategory: (cat: EventCategory) => void;
}

export default function RightPanel({
  activeTab,
  onTabChange,
  intelEvents,
  polymarketEvents,
  eventsLoading,
  eventsError,
  selectedId,
  activeCategories,
  onSelect,
  onToggleCategory,
}: RightPanelProps) {
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
        fontFamily: FONT_SANS,
        pointerEvents: "all",
        zIndex: 10,
        background: "rgba(10,14,23,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Tab bar */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.2)",
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1,
                padding: "10px 4px",
                border: "none",
                background: "transparent",
                color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.07em",
                cursor: "pointer",
                borderBottom: isActive ? "2px solid #38bdf8" : "2px solid transparent",
                transition: "all 0.15s",
                fontFamily: FONT_SANS,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {activeTab === "events" && (
          <EventPanel
            events={intelEvents}
            loading={eventsLoading}
            error={eventsError}
            selectedId={selectedId}
            activeCategories={activeCategories}
            onSelect={onSelect}
            onToggleCategory={onToggleCategory}
          />
        )}
        {activeTab === "predictions" && (
          <PolymarketPanel
            events={polymarketEvents}
            loading={eventsLoading}
            error={eventsError}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
        {activeTab === "supply-chain" && (
          <CommoditiesImpactPanel />
        )}
      </div>
    </div>
  );
}
