import type { GlobeEvent, EventCategory } from "../types";
import { FONT_SANS } from "../styles/fonts";
import EventPanel from "./EventPanel";
import PolymarketPanel from "./PolymarketPanel";
import CommoditiesImpactPanel from "./CommoditiesImpactPanel";
import ClimatePanel from "./ClimatePanel";
import type { ClimateAlertLevel, ClimateReadModel } from "../types/climate";

export type RightPanelTab = "events" | "predictions" | "supply-chain" | "climate";

const SHOW_CLIMATE_TAB = false;

const TABS: { id: RightPanelTab; label: string }[] = [
  { id: "events",       label: "EVENTS" },
  { id: "predictions",  label: "PREDICTIONS" },
  { id: "supply-chain", label: "SUPPLY CHAIN" },
  { id: "climate",      label: "CLIMATE" },
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
  climateData: ClimateReadModel;
  selectedClimateId: string | null;
  activeClimateAlerts: Set<ClimateAlertLevel>;
  onSelectClimate: (id: string | null) => void;
  onToggleClimateAlert: (alert: ClimateAlertLevel) => void;
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
  climateData,
  selectedClimateId,
  activeClimateAlerts,
  onSelectClimate,
  onToggleClimateAlert,
}: RightPanelProps) {
  const visibleActiveTab = !SHOW_CLIMATE_TAB && activeTab === "climate" ? "events" : activeTab;

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
        {TABS.filter((tab) => SHOW_CLIMATE_TAB || tab.id !== "climate").map(tab => {
          const isActive = visibleActiveTab === tab.id;
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
        {visibleActiveTab === "events" && (
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
        {visibleActiveTab === "predictions" && (
          <PolymarketPanel
            events={polymarketEvents}
            loading={eventsLoading}
            error={eventsError}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
        {visibleActiveTab === "supply-chain" && (
          <CommoditiesImpactPanel />
        )}
        {SHOW_CLIMATE_TAB && visibleActiveTab === "climate" && (
          <ClimatePanel
            data={climateData}
            selectedId={selectedClimateId}
            activeAlerts={activeClimateAlerts}
            onSelect={onSelectClimate}
            onToggleAlert={onToggleClimateAlert}
          />
        )}
      </div>
    </div>
  );
}
