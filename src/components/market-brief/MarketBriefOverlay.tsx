import { useState } from "react";
import ConflictStatusPanel from "./ConflictStatusPanel";
import CrossAssetDashboard from "./CrossAssetDashboard";
import ClientExposurePanel from "./ClientExposurePanel";
import TradeIdeasPanel from "./TradeIdeasPanel";
import SanctionsTrackerPanel from "./SanctionsTrackerPanel";
import ClientBriefPanel from "./ClientBriefPanel";

// Inject Google Fonts once at module load
const _fontLink = document.createElement("link");
_fontLink.rel = "stylesheet";
_fontLink.href =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Barlow+Condensed:wght@400;600;700&display=swap";
document.head.appendChild(_fontLink);

const CONDENSED = "'Barlow Condensed', system-ui, sans-serif";

const TABS = [
  { id: 0, label: "Conflict Status" },
  { id: 1, label: "Cross-Asset" },
  { id: 2, label: "Client Exposure" },
  { id: 3, label: "Trade Ideas" },
  { id: 4, label: "Sanctions" },
  { id: 5, label: "Client Brief" },
];

export default function MarketBriefOverlay() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.25)",
          color: "#38bdf8",
          padding: "6px 18px",
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          cursor: "pointer",
          fontFamily: CONDENSED,
          backdropFilter: "blur(8px)",
          whiteSpace: "nowrap",
        }}
      >
        MARKET BRIEF
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            background: "rgba(6,9,18,0.82)",
            display: "flex",
            flexDirection: "column",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Header: tab bar + close */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              padding: "0 24px",
              flexShrink: 0,
              background: "rgba(10,14,23,0.6)",
            }}
          >
            {/* Logo / title */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.22)",
                fontFamily: CONDENSED,
                marginRight: 24,
                whiteSpace: "nowrap",
                textTransform: "uppercase",
              }}
            >
              Market Brief
            </span>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, flex: 1 }}>
              {TABS.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    onMouseEnter={() => setHoveredTab(tab.id)}
                    onMouseLeave={() => setHoveredTab(null)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom: active
                        ? "2px solid #38bdf8"
                        : "2px solid transparent",
                      color: active
                        ? "#38bdf8"
                        : hoveredTab === tab.id
                        ? "rgba(255,255,255,0.7)"
                        : "rgba(255,255,255,0.38)",
                      padding: "13px 16px",
                      fontSize: 12,
                      fontWeight: active ? 700 : 400,
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                      fontFamily: CONDENSED,
                      textTransform: "uppercase",
                      transition: "color 0.15s, border-color 0.15s",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.45)",
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                cursor: "pointer",
                fontFamily: CONDENSED,
                textTransform: "uppercase",
                marginLeft: 16,
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Content area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 24,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.12) transparent",
            }}
          >
            {activeTab === 0 && <ConflictStatusPanel />}
            {activeTab === 1 && <CrossAssetDashboard />}
            {activeTab === 2 && <ClientExposurePanel />}
            {activeTab === 3 && <TradeIdeasPanel />}
            {activeTab === 4 && <SanctionsTrackerPanel />}
            {activeTab === 5 && <ClientBriefPanel />}
          </div>
        </div>
      )}
    </>
  );
}
