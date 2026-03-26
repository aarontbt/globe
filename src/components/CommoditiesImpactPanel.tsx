import { useState } from "react";
import type { CommodityAsset, CommodityCategory } from "../types";
import { FONT_SANS } from "../styles/fonts";
import commoditiesData from "../data/commodities-impact.json";

const SIGNAL_COLOR: Record<string, string> = {
  red:   "#ef4444",
  amber: "#f59e0b",
  green: "#4ade80",
};

function SignalDot({ signal, size = 7 }: { signal: string; size?: number }) {
  const color = SIGNAL_COLOR[signal] ?? "#6b7280";
  return (
    <span style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 5px ${color}88`,
      flexShrink: 0,
    }} />
  );
}

function AssetRow({ asset }: { asset: CommodityAsset }) {
  const [expanded, setExpanded] = useState(false);
  const changeNum = parseFloat(asset.change1d);
  const changeColor = changeNum > 0 ? "#f87171" : changeNum < 0 ? "#4ade80" : "rgba(255,255,255,0.4)";

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        padding: "8px 10px",
        marginBottom: 4,
        borderRadius: 8,
        cursor: "pointer",
        background: expanded ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${expanded ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)"}`,
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SignalDot signal={asset.signal} />
        <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
          {asset.name}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
            {asset.current.toLocaleString()} <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>{asset.unit}</span>
          </div>
          <div style={{ fontSize: 10, color: changeColor, fontWeight: 600 }}>{asset.change1d}</div>
        </div>
        <div style={{
          minWidth: 36,
          textAlign: "right",
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
        }}>
          z={asset.zscore > 0 ? "+" : ""}{asset.zscore.toFixed(1)}
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11,
          lineHeight: 1.55,
          color: "rgba(255,255,255,0.55)",
        }}>
          {asset.narrative}
          <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            <span>30d baseline: {asset.baseline30d.toLocaleString()}</span>
            <span>90d baseline: {asset.baseline90d.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CategorySection({ category }: { category: CommodityCategory }) {
  const [open, setOpen] = useState(true);

  const worstSignal = category.assets.some(a => a.signal === "red")
    ? "red"
    : category.assets.some(a => a.signal === "amber")
    ? "amber"
    : "green";

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 10px",
          borderRadius: open ? "8px 8px 0 0" : 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: open ? "none" : "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <SignalDot signal={worstSignal} size={6} />
        <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          {category.label}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
          {category.assets.length} assets
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 4 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>

      {open && (
        <div style={{
          background: "rgba(255,255,255,0.015)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          padding: "8px 8px 4px",
        }}>
          <div style={{
            fontSize: 11,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.4)",
            marginBottom: 8,
            padding: "0 2px",
            borderLeft: "2px solid rgba(239,68,68,0.3)",
            paddingLeft: 8,
          }}>
            {category.supplyChainImpact}
          </div>
          {category.assets.map(asset => (
            <AssetRow key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommoditiesImpactPanel() {
  const categories = commoditiesData.categories as CommodityCategory[];

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      fontFamily: FONT_SANS,
    }}>
      {/* Scenario banner */}
      <div style={{
        flexShrink: 0,
        padding: "8px 12px",
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.18)",
        borderRadius: 8,
        margin: "10px 12px 4px",
        display: "flex",
        alignItems: "center",
        gap: 7,
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#ef4444",
          boxShadow: "0 0 6px #ef4444",
          flexShrink: 0,
          display: "inline-block",
        }} />
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#f87171", letterSpacing: "0.1em" }}>
            HORMUZ CRISIS — SUPPLY CHAIN IMPACT
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
            Day 26 · as of {commoditiesData.asOf.slice(0, 10)}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "6px 10px 10px",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.12) transparent",
      }}>
        {categories.map(cat => (
          <CategorySection key={cat.id} category={cat} />
        ))}
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 8, paddingBottom: 4 }}>
          Click any asset row to expand crisis narrative · {commoditiesData.scenario}
        </div>
      </div>
    </div>
  );
}
