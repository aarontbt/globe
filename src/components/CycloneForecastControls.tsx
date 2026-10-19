import { cycloneFreshness, cycloneMarker, utcLabel } from "../domain/cyclone";
import type { CycloneForecastState } from "../hooks/useCycloneForecasts";
import type { CycloneStorm } from "../types/cyclone";

export interface CycloneControlProps {
  cyclones: CycloneForecastState;
  cyclonesEnabled: boolean;
  onCyclonesEnabledChange: (enabled: boolean) => void;
  showCycloneUncertainty: boolean;
  onCycloneUncertaintyChange: (enabled: boolean) => void;
  onFocusCyclone: (storm: CycloneStorm) => void;
}

const buttonStyle = {
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 5, padding: "5px 8px", color: "#a5f3fc", cursor: "pointer", fontSize: 11,
};

export default function CycloneForecastControls({ cyclones, cyclonesEnabled, onCyclonesEnabledChange, showCycloneUncertainty, onCycloneUncertaintyChange, onFocusCyclone }: CycloneControlProps) {
  const { manifest, storms, selected, now, loading, error } = cyclones;
  const dailyDelivery = manifest?.deliveryMode === "daily";
  const freshness = (storm: CycloneStorm) => cycloneFreshness(storm, now, dailyDelivery ? 30 : 12);
  const failedSources = manifest?.sources.filter(source => source.status === "error") ?? [];
  const checkOverdue = !dailyDelivery && manifest?.sources.some(source => now - Date.parse(source.checkedAt) > 3600_000);
  const noActive = manifest && !manifest.storms.length && !failedSources.length && !checkOverdue;
  const uncertaintyLabel = selected?.uncertaintyKind === "probability-circles" ? "70% position range"
    : selected?.uncertaintyKind === "cone" ? "Forecast cone" : "Uncertainty area";

  return <section aria-label="Tropical cyclone forecasts" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
    <label style={{ display: "flex", gap: 9, alignItems: "center", padding: "9px 10px", borderRadius: 7, background: "rgba(255,255,255,0.035)", color: "#fda4af", fontSize: 12 }}>
      <input type="checkbox" aria-label="Tropical cyclone forecasts" checked={cyclonesEnabled} onChange={e => onCyclonesEnabledChange(e.target.checked)} style={{ accentColor: "#fb7185" }} />
      Tropical cyclone forecasts
    </label>
    {cyclonesEnabled && <div style={{ marginTop: 9 }}>
      {loading && !manifest && <div role="status">Loading forecasts…</div>}
      {error && <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "#fbbf24" }}>
        <span>{manifest ? "Update failed; showing latest available." : "Forecasts unavailable."}</span>
        <button type="button" onClick={cyclones.retry} disabled={loading} style={buttonStyle}>Retry</button>
      </div>}
      {failedSources.length > 0 && <div role="status" style={{ color: "#fbbf24", marginTop: 5 }}>Partial source data: {failedSources.map(source => source.agency).join(", ")}.</div>}
      {checkOverdue && <div role="status" style={{ color: "#fbbf24", marginTop: 5 }}>Forecast sources are delayed.</div>}
      {!selected && !loading && <div role="status" style={{ marginTop: 7, color: "#cbd5e1" }}>
        {noActive ? "No active storms reported." : manifest?.storms.length ? "No current forecasts available." : "Forecasts unavailable."}
      </div>}
      {selected && <>
        <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 8 }}>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>Select storm</span>
            <select aria-label="Select tropical cyclone" value={selected.id} onChange={e => {
              cyclones.select(e.target.value);
              const storm = storms.find(item => item.id === e.target.value);
              if (storm) onFocusCyclone(storm);
            }} style={{ ...buttonStyle, width: "100%", boxSizing: "border-box", overflow: "hidden", textOverflow: "ellipsis" }}>
              {storms.map(storm => <option key={storm.id} value={storm.id}>{storm.name} · {storm.agency}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => onFocusCyclone(selected)} style={{ ...buttonStyle, whiteSpace: "nowrap" }}>Focus</button>
        </div>
        <div style={{ marginTop: 5, color: "#cbd5e1" }}>{selected.agency} · {selected.basin} · Issued {utcLabel(selected.issuedAt)}</div>
        {freshness(selected) === "stale" && <div role="status" style={{ color: "#fbbf24", marginTop: 3 }}>Advisory is old.</div>}
        <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7 }}>
          <input type="checkbox" aria-label={uncertaintyLabel} checked={showCycloneUncertainty} onChange={e => onCycloneUncertaintyChange(e.target.checked)} disabled={selected.uncertaintyKind === "unavailable"} />
          {uncertaintyLabel}
        </label>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", color: "#cbd5e1" }}>Forecast details</summary>
          <div style={{ marginTop: 6 }}>Analysis {utcLabel(selected.points[0].validAt)}</div>
          <div>{selected.uncertaintyNote}</div>
          <div style={{ marginTop: 5 }}><span style={{ color: "#fb7185" }}>━</span> Forecast positions · <span style={{ color: "#cbd5e1" }}>━</span> Past track</div>
          <div>Lines join published positions; they do not predict between them.</div>
          <div>{selected.agency === "NHC" ? "NHC labels 1–5 are hurricane categories; TS/TD mean tropical storm/depression." : "JMA forecast points do not include wind intensity."}</div>
          <details style={{ marginTop: 7 }}>
            <summary style={{ cursor: "pointer" }}>Positions ({selected.points.length - 1})</summary>
            {selected.points.map((point, index) => <div key={point.validAt} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ color: "#e2e8f0" }}>{index === 0 ? "Analysis" : `+${point.leadHours}h`} · {utcLabel(point.validAt)}</div>
              <div>{Math.abs(point.position[1]).toFixed(1)}°{point.position[1] >= 0 ? "N" : "S"}, {Math.abs(point.position[0]).toFixed(1)}°{point.position[0] >= 0 ? "E" : "W"} · {cycloneMarker(point, selected.agency)}</div>
              <div>{point.windKnots !== null ? `${point.windKnots} kt (${selected.windAveragingMinutes}-min)` : "Wind unavailable"}{point.probabilityRadiusKm !== null ? ` · radius ${point.probabilityRadiusKm.toFixed(1)} km` : ""}</div>
            </div>)}
          </details>
          <a href={selected.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", color: "#67e8f9", marginTop: 7 }}>Official {selected.agency} advisory ↗</a>
        </details>
      </>}
      <details style={{ marginTop: 9 }}>
        <summary style={{ cursor: "pointer", color: "#94a3b8" }}>Coverage & sources</summary>
        <div style={{ marginTop: 6 }}>JMA covers the western North Pacific and South China Sea. NHC covers the Atlantic and eastern North Pacific.</div>
        <div style={{ marginTop: 5 }}>Indian Ocean and Australian-region forecasts are not included.</div>
        {manifest?.sources.map(source => <div key={source.agency} style={{ marginTop: 7 }}>
          <a href={source.url} target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>{source.agency} ↗</a> · {source.status === "error" ? "unavailable" : `${source.stormCount} storms`}
          <div>Checked {utcLabel(source.checkedAt)}{source.lastSuccessfulAt ? ` · last success ${utcLabel(source.lastSuccessfulAt)}` : ""}</div>
        </div>)}
        <div style={{ marginTop: 7 }}>Local warnings: <a href="https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>PAGASA ↗</a> · <a href="https://www.hko.gov.hk/en/informtc/tcMain.htm" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>HKO ↗</a> · <a href="https://rsmcnewdelhi.imd.gov.in/" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>IMD ↗</a></div>
        <div style={{ marginTop: 5 }}>Tracks do not establish local impacts; follow official warnings.</div>
      </details>
    </div>}
  </section>;
}
