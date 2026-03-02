import { useState } from "react";

export interface LayerVisibility {
  showLanes: boolean;
  showCorridors: boolean;
  showPorts: boolean;
  showArcs: boolean;
  showVessels: boolean;
  showEvents: boolean;
  showAircraft: boolean;
  showSatellites: boolean;
}

interface LayerTogglePanelProps {
  visibility: LayerVisibility;
  onChange: (key: keyof LayerVisibility, value: boolean) => void;
}

interface ToggleRowProps {
  label: string;
  swatch: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
}

function ToggleSwitch({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className="cursor-pointer relative flex-shrink-0"
      style={{
        width: 28,
        height: 16,
        borderRadius: 9999,
        backgroundColor: checked ? "#06b6d4" : "rgba(255,255,255,0.15)",
        transition: "background-color 0.2s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 14 : 2,
          width: 12,
          height: 12,
          borderRadius: 9999,
          backgroundColor: "#fff",
          transition: "left 0.2s ease",
        }}
      />
    </div>
  );
}

function ToggleRow({ label, swatch, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span className="text-[11px] text-white/70 text-right">{label}</span>
        {swatch}
      </div>
      <ToggleSwitch checked={checked} onToggle={onToggle} />
    </div>
  );
}

export default function LayerTogglePanel({ visibility, onChange }: LayerTogglePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
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
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <span style={{ color: "#06b6d4", fontSize: 8, lineHeight: 1 }}>◧</span>
        LAYERS
      </button>
    );
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "rgba(6,9,18,0.93)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 12,
        padding: "12px 14px",
        backdropFilter: "blur(18px)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: "#06b6d4", fontSize: 9 }}>◧</span>
          <span style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
          }}>
            Layers
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

      <div className="flex flex-col gap-2">
        <ToggleRow
          label="Shipping Lanes"
          swatch={<div className="w-5 h-[3px] rounded-full bg-cyan-400" />}
          checked={visibility.showLanes}
          onToggle={() => onChange("showLanes", !visibility.showLanes)}
        />
        <ToggleRow
          label="Corridors"
          swatch={<div className="w-5 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-lime-400" />}
          checked={visibility.showCorridors}
          onToggle={() => onChange("showCorridors", !visibility.showCorridors)}
        />
        <ToggleRow
          label="Ports"
          swatch={
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-teal-400" />
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <div className="w-2 h-2 rounded-full bg-orange-500" />
            </div>
          }
          checked={visibility.showPorts}
          onToggle={() => onChange("showPorts", !visibility.showPorts)}
        />
        <ToggleRow
          label="Trade Arcs"
          swatch={<div className="w-5 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" />}
          checked={visibility.showArcs}
          onToggle={() => onChange("showArcs", !visibility.showArcs)}
        />
        <ToggleRow
          label="Vessels"
          swatch={
            <div className="flex w-5 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          }
          checked={visibility.showVessels}
          onToggle={() => onChange("showVessels", !visibility.showVessels)}
        />
        <ToggleRow
          label="Events"
          swatch={
            <div className="flex w-5 justify-center">
              <div className="w-2 h-2 rounded-full bg-red-400" style={{ boxShadow: "0 0 4px #f87171" }} />
            </div>
          }
          checked={visibility.showEvents}
          onToggle={() => onChange("showEvents", !visibility.showEvents)}
        />
        <ToggleRow
          label="Civil Aircraft"
          swatch={
            <div className="flex w-5 justify-center">
              <div className="w-2 h-2 rounded-full bg-white" style={{ boxShadow: "0 0 4px rgba(255,255,255,0.8)" }} />
            </div>
          }
          checked={visibility.showAircraft}
          onToggle={() => onChange("showAircraft", !visibility.showAircraft)}
        />
        <ToggleRow
          label="Satellites"
          swatch={
            <div className="flex w-5 justify-center">
              <div className="w-2 h-2 rounded-full" style={{ background: "#00ffdc", boxShadow: "0 0 4px #00ffdc" }} />
            </div>
          }
          checked={visibility.showSatellites}
          onToggle={() => onChange("showSatellites", !visibility.showSatellites)}
        />
      </div>
    </div>
  );
}
