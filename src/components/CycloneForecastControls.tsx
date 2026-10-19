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
const buttonStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 4, padding: "4px 7px", color: "#a5f3fc", cursor: "pointer", fontSize: 10 };
export default function CycloneForecastControls({ cyclones, cyclonesEnabled, onCyclonesEnabledChange, showCycloneUncertainty, onCycloneUncertaintyChange, onFocusCyclone }: CycloneControlProps) {
  const { manifest, storms, selected, now, loading, error } = cyclones;
  const sourceFailed = manifest?.sources.some(s => s.status === "error");
  const checkOverdue = manifest?.sources.some(s => now - Date.parse(s.checkedAt) > 3600_000);
  const noActive = manifest && !manifest.storms.length && !sourceFailed && !checkOverdue;
  return <section aria-label="Tropical cyclone forecasts" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
    <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fda4af", fontSize: 11 }}>
      <input type="checkbox" aria-label="Tropical cyclone forecasts" checked={cyclonesEnabled} onChange={e => onCyclonesEnabledChange(e.target.checked)} style={{ accentColor: "#fb7185" }} />
      Tropical cyclone forecasts
    </label>
    <div style={{ marginTop: 4 }}>Typhoons, tropical storms & hurricanes</div>
    {cyclonesEnabled && <>
      <div style={{ marginTop: 6 }}>Latest advisories · independent of satellite playback</div>
      {loading && <div role="status">Checking forecast feed…</div>}
      {error && <div role="status" style={{ color: "#fbbf24" }}>{error}</div>}
      {sourceFailed && <div role="status" style={{ color: "#fbbf24" }}>Some sources failed to refresh. Retained advisories may be incomplete.</div>}
      {checkOverdue && <div role="status" style={{ color: "#fbbf24" }}>Source checks are over an hour old.</div>}
      {!selected && !loading && <div role="status" style={{ marginTop: 8, color: "#cbd5e1" }}>
        {noActive ? "No active storms reported in the covered basins." : manifest?.storms.length ? "Retained forecasts have expired and are hidden." : "Forecasts currently unavailable; this does not mean there are no storms."}
      </div>}
      <button type="button" onClick={cyclones.retry} disabled={loading} style={{ ...buttonStyle, marginTop: 6 }}>Refresh forecasts</button>
      {selected && <>
        <label style={{ display: "block", marginTop: 10, color: "#e2e8f0" }}>Storm
          <select aria-label="Select tropical cyclone" value={selected.id} onChange={e => {
            cyclones.select(e.target.value);
            const storm = storms.find(s => s.id === e.target.value);
            if (storm) onFocusCyclone(storm);
          }} style={{ ...buttonStyle, display: "block", width: "100%", marginTop: 4 }}>
            {storms.map(s => <option key={s.id} value={s.id}>{s.name} · {s.agency}{cycloneFreshness(s, now) === "stale" ? " · stale" : ""}</option>)}
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <strong style={{ color: "#e2e8f0", fontSize: 12 }}>{selected.name}</strong>
          <button type="button" onClick={() => onFocusCyclone(selected)} style={buttonStyle}>Focus on storm</button>
        </div>
        <div>{selected.agency} · {selected.basin}</div>
        <div>{selected.agency === "JMA" ? "Storm" : "Advisory"} {selected.advisory} · issued {utcLabel(selected.issuedAt)}</div>
        <div>Analysis {utcLabel(selected.points[0].validAt)}</div>
        {cycloneFreshness(selected, now) === "stale" && <div role="status" style={{ color: "#fbbf24" }}>Advisory over 12 hours old. Forecast confidence may have changed.</div>}
        <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, color: "#cbd5e1" }}>
          <input type="checkbox" aria-label="Forecast uncertainty" checked={showCycloneUncertainty} onChange={e => onCycloneUncertaintyChange(e.target.checked)} disabled={selected.uncertaintyKind === "unavailable"} />
          {selected.uncertaintyKind === "probability-circles" ? "70% position probability circles" : "Forecast uncertainty cone"}
        </label>
        <div style={{ marginTop: 4, fontSize: 9 }}>{selected.uncertaintyNote}</div>
        <div style={{ marginTop: 6, fontSize: 9 }}><span style={{ color: "#fb7185" }}>━</span> Forecast positions · <span style={{ color: "#cbd5e1" }}>━</span> Past track</div>
        <div style={{ fontSize: 9 }}>Hover markers for valid times. Connecting lines do not predict intermediate positions.</div>
        <div style={{ marginTop: 5, fontSize: 9 }}>{selected.agency === "NHC" ? "1–5: NHC hurricane category · TS: tropical storm · TD: depression. Winds use 1-minute averages." : "TY: JMA typhoon · TS: tropical storm · F: forecast position. Forecast wind intensity is not supplied by this feed."}</div>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", color: "#e2e8f0" }}>Forecast positions ({selected.points.length - 1})</summary>
          {selected.points.map((p, index) => <div key={p.validAt} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#e2e8f0" }}>{index === 0 ? "Analysis" : `+${p.leadHours}h`} · {utcLabel(p.validAt)}</div>
            <div>{Math.abs(p.position[1]).toFixed(1)}°{p.position[1] >= 0 ? "N" : "S"}, {Math.abs(p.position[0]).toFixed(1)}°{p.position[0] >= 0 ? "E" : "W"} · {cycloneMarker(p, selected.agency)}</div>
            <div>{p.windKnots !== null ? `${p.windKnots} kt (${selected.windAveragingMinutes}-min)` : "Wind intensity unavailable"}{p.probabilityRadiusKm !== null ? ` · radius ${p.probabilityRadiusKm.toFixed(1)} km` : ""}</div>
          </div>)}
        </details>
        <a href={selected.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", color: "#67e8f9", marginTop: 8 }}>Official {selected.agency} advisory ↗</a>
      </>}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", color: "#cbd5e1" }}>Coverage & source checks</summary>
        <div style={{ marginTop: 6 }}>JMA: western North Pacific / South China Sea, including Philippines and Vietnam approaches. NHC: Atlantic / eastern North Pacific. Indian Ocean and Australian-region forecasts are not included.</div>
        {manifest?.sources.map(s => <div key={s.agency} style={{ marginTop: 7 }}>
          <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>{s.agency} ↗</a> · {s.status === "error" ? "refresh failed" : `${s.stormCount} storm(s)`}
          <div>Checked {utcLabel(s.checkedAt)}</div>
          {s.lastSuccessfulAt && <div>Last success {utcLabel(s.lastSuccessfulAt)}</div>}
        </div>)}
        <div style={{ marginTop: 8 }}>Local warnings: <a href="https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>PAGASA ↗</a> · <a href="https://www.hko.gov.hk/en/informtc/tcMain.htm" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>Hong Kong Observatory ↗</a> · <a href="https://rsmcnewdelhi.imd.gov.in/" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>IMD / Bay of Bengal ↗</a></div>
        <div style={{ marginTop: 5 }}>Forecast paths do not establish asset disruption. Refer to national meteorological services for local warnings.</div>
      </details>
    </>}
  </section>;
}
