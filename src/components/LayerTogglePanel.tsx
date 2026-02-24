export interface LayerVisibility {
  showLanes: boolean;
  showCorridors: boolean;
  showPorts: boolean;
  showArcs: boolean;
  showVessels: boolean;
  showEvents: boolean;
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
  return (
    <div className="absolute bottom-6 left-6 z-10 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl">
      <h2 className="text-[10px] tracking-[0.2em] text-white/40 uppercase mb-2.5">Layers</h2>
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
      </div>
    </div>
  );
}
