import { useState } from "react";
import ConflictStatusPanel from "./ConflictStatusPanel";
import CrossAssetDashboard from "./CrossAssetDashboard";
import ExposureTracePanel, {
  CommercialEvaluationPanel,
  TraceActionsPanel,
  TraceCounterpartiesPanel,
  TraceEvidencePanel,
} from "./ExposureTracePanel";
import { FONT_SANS } from "../../styles/fonts";
import type { ExposureTraceData } from "../../types";

type TabId =
  | "trace"
  | "signals"
  | "transmission"
  | "commercial"
  | "counterparties"
  | "actions"
  | "evidence";

const PRIMARY_TABS: Array<{ id: TabId; label: string }> = [
  { id: "trace", label: "Exposure Trace" },
  { id: "signals", label: "Signals" },
  { id: "transmission", label: "Market Transmission" },
  { id: "commercial", label: "Commercial Evaluation" },
  { id: "counterparties", label: "Counterparties" },
  { id: "actions", label: "Actions" },
  { id: "evidence", label: "Evidence" },
];

interface MarketBriefOverlayProps {
  data: ExposureTraceData;
  activeTraceId: string;
  onTraceChange: (traceId: string) => void;
}

export default function MarketBriefOverlay({
  data,
  activeTraceId,
  onTraceChange,
}: MarketBriefOverlayProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("trace");
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null);

  const renderTab = (tab: { id: TabId; label: string }) => {
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
          borderBottom: active ? "2px solid #38bdf8" : "2px solid transparent",
          color: active
            ? "#38bdf8"
            : hoveredTab === tab.id
              ? "rgba(255,255,255,0.7)"
              : "rgba(255,255,255,0.38)",
          padding: "13px 10px",
          fontSize: 10,
          fontWeight: active ? 700 : 500,
          letterSpacing: "0.06em",
          cursor: "pointer",
          fontFamily: FONT_SANS,
          textTransform: "uppercase",
          transition: "color 0.15s, border-color 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        {tab.label}
      </button>
    );
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => {
            setActiveTab("trace");
            setOpen(true);
          }}
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
            fontFamily: FONT_SANS,
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "#38bdf8", fontSize: 8, lineHeight: 1 }}>→</span>
          SIGNAL → EXPOSURE
        </button>
      )}

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            background: "rgba(6,9,18,0.97)",
            backdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            fontFamily: FONT_SANS,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              padding: "0 18px",
              flexShrink: 0,
              background: "rgba(10,14,23,0.96)",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.28)",
                marginRight: 14,
                whiteSpace: "nowrap",
                textTransform: "uppercase",
              }}
            >
              Signal → Exposure
            </span>

            <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
              {PRIMARY_TABS.map(renderTab)}
            </div>

            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.45)",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: FONT_SANS,
                textTransform: "uppercase",
                marginLeft: 10,
                whiteSpace: "nowrap",
              }}
            >
              ✕ Close
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "18px 24px 24px",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.12) transparent",
            }}
          >
            {activeTab === "trace" && (
              <ExposureTracePanel data={data} activeTraceId={activeTraceId} onTraceChange={onTraceChange} />
            )}
            {activeTab === "signals" && <ConflictStatusPanel />}
            {activeTab === "transmission" && <CrossAssetDashboard />}
            {activeTab === "commercial" && (
              <CommercialEvaluationPanel data={data} activeTraceId={activeTraceId} onTraceChange={onTraceChange} />
            )}
            {activeTab === "counterparties" && (
              <TraceCounterpartiesPanel data={data} activeTraceId={activeTraceId} onTraceChange={onTraceChange} />
            )}
            {activeTab === "actions" && (
              <TraceActionsPanel data={data} activeTraceId={activeTraceId} onTraceChange={onTraceChange} />
            )}
            {activeTab === "evidence" && (
              <TraceEvidencePanel data={data} activeTraceId={activeTraceId} onTraceChange={onTraceChange} />
            )}
          </div>

        </div>
      )}
    </>
  );
}
