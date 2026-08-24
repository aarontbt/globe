import { CLIMATE_ALERT_COLORS, formatClimateTime, isClimateHazardActive, resolveClimateFreshness } from "../domain/climate";
import { FONT_SANS } from "../styles/fonts";
import type { ClimateAlertLevel, ClimateReadModel } from "../types/climate";

const ALERTS: ClimateAlertLevel[] = ["red", "orange", "green"];

interface ClimatePanelProps {
  data: ClimateReadModel;
  selectedId: string | null;
  activeAlerts: Set<ClimateAlertLevel>;
  onSelect: (id: string | null) => void;
  onToggleAlert: (alert: ClimateAlertLevel) => void;
}

function rgb(alert: ClimateAlertLevel) {
  return `rgb(${CLIMATE_ALERT_COLORS[alert].join(",")})`;
}

export default function ClimatePanel({ data, selectedId, activeAlerts, onSelect, onToggleAlert }: ClimatePanelProps) {
  const freshness = resolveClimateFreshness(data.sourceStatus);
  const activeHazards = data.hazards.filter((hazard) => isClimateHazardActive(hazard));
  const hazards = activeHazards.filter((hazard) => activeAlerts.has(hazard.alertLevel));
  const selected = activeHazards.find((hazard) => hazard.id === selectedId) ?? null;
  const selectedImpacts = selected ? data.impacts.filter((impact) => impact.hazardId === selected.id) : [];
  const freshnessColor = freshness === "fresh" ? "#4ade80" : freshness === "stale" ? "#fbbf24" : "#94a3b8";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: FONT_SANS }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.92)", fontWeight: 700, fontSize: 13 }}>Climate disruption</div>
            <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 9, marginTop: 3 }}>GDACS · staged event refresh</div>
          </div>
          <span style={{ color: freshnessColor, border: `1px solid ${freshnessColor}55`, borderRadius: 4, padding: "2px 6px", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {freshness}
          </span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 7 }}>
          Updated {formatClimateTime(data.sourceStatus.lastSuccessfulAt)}
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
          {ALERTS.map((alert) => {
            const active = activeAlerts.has(alert);
            const alertColor = rgb(alert);
            return (
              <button key={alert} onClick={() => onToggleAlert(alert)} style={{ flex: 1, border: `1px solid ${active ? alertColor : "rgba(255,255,255,0.08)"}`, background: active ? `${alertColor.replace("rgb", "rgba").replace(")", ",0.12)")}` : "transparent", color: active ? alertColor : "rgba(255,255,255,0.28)", borderRadius: 5, padding: "5px 2px", fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
                {alert}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 10 }}>
        {hazards.length === 0 && (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "rgba(255,255,255,0.38)", fontSize: 11, lineHeight: 1.55 }}>
            {activeHazards.length === 0 ? "No active cyclone or flood hazards are present in the promoted corridor snapshot." : "No hazards match the selected alert filters."}
          </div>
        )}
        {hazards.map((hazard) => {
          const isSelected = selectedId === hazard.id;
          const impactCount = data.impacts.filter((impact) => impact.hazardId === hazard.id).length;
          return (
            <button key={hazard.id} onClick={() => onSelect(isSelected ? null : hazard.id)} style={{ width: "100%", textAlign: "left", display: "block", border: `1px solid ${isSelected ? `${rgb(hazard.alertLevel)}88` : "rgba(255,255,255,0.07)"}`, background: isSelected ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.02)", borderRadius: 8, padding: 10, marginBottom: 7, cursor: "pointer", fontFamily: FONT_SANS }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: rgb(hazard.alertLevel), boxShadow: `0 0 8px ${rgb(hazard.alertLevel)}` }} />
                <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 700, flex: 1 }}>{hazard.title}</span>
                <span style={{ color: "rgba(255,255,255,0.32)", fontSize: 8, textTransform: "uppercase" }}>{hazard.type === "flood" ? "Flood" : "Cyclone"}</span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 9, marginTop: 6 }}>
                {hazard.countries.join(", ") || "Regional"} · {formatClimateTime(hazard.updatedAt)}
              </div>
              <div style={{ color: impactCount ? "#67e8f9" : "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 5 }}>
                {hazard.impactAssessment === "unavailable" ? "Impact unavailable · point-only source geometry" : `${impactCount} linked target${impactCount === 1 ? "" : "s"}`}
              </div>
            </button>
          );
        })}

        {selected && (
          <div style={{ marginTop: 5, padding: 11, borderRadius: 8, border: "1px solid rgba(56,189,248,0.18)", background: "rgba(8,47,73,0.16)" }}>
            <div style={{ color: "#7dd3fc", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Affected targets</div>
            {selectedImpacts.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, lineHeight: 1.5, marginTop: 7 }}>No deterministic footprint intersection is available.</div>
            ) : selectedImpacts.map((impact) => (
              <div key={impact.id} style={{ marginTop: 7 }}>
                <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 10 }}>{impact.targetName}</div>
                <div style={{ color: "rgba(255,255,255,0.34)", fontSize: 8, marginTop: 2, textTransform: "uppercase" }}>{impact.targetType} · {impact.relationship} · derived</div>
              </div>
            ))}
            <a href={selected.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", color: "#38bdf8", fontSize: 9, marginTop: 11, textDecoration: "none" }}>Open GDACS source ↗</a>
          </div>
        )}
      </div>
    </div>
  );
}
