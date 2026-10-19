import { useState } from "react";
import CycloneForecastControls, { type CycloneControlProps } from "./CycloneForecastControls";
import { FONT_SANS } from "../styles/fonts";
import type { useWeatherImagery } from "../hooks/useWeatherImagery";

interface WeatherControlsProps extends CycloneControlProps {
  enhanced: boolean;
  onEnhancedChange: (value: boolean) => void;
  weather: ReturnType<typeof useWeatherImagery>;
  opacity: number;
  onOpacityChange: (value: number) => void;
}

const quietButton = {
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 5, padding: "5px 8px", color: "#a5f3fc", cursor: "pointer", fontSize: 11,
};
const rowStyle = {
  display: "flex", alignItems: "center", gap: 9, width: "100%", boxSizing: "border-box" as const,
  padding: "9px 10px", borderRadius: 7, background: "rgba(255,255,255,0.035)",
};

export function WeatherLayerControl({ enabled, onEnabledChange, ...controls }: WeatherControlsProps & {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { weather } = controls;
  return (
    <div style={{ position: "relative", flexShrink: 0, fontFamily: FONT_SANS }} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
      <button type="button" aria-label="Weather" aria-expanded={open} aria-controls="weather-detail-panel"
        onClick={() => {
          if (!open && !enabled) onEnabledChange(true);
          else if (!open) weather.retry();
          setOpen(!open);
        }}
        style={{ display: "flex", width: 92, justifyContent: "center", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer", fontFamily: FONT_SANS,
          background: "rgba(8,12,22,0.92)", border: `1px solid ${enabled ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.15)"}`,
          borderRadius: 8, padding: "5px 11px", color: enabled ? "#a5f3fc" : "rgba(255,255,255,0.65)", fontSize: 10, letterSpacing: "0.06em" }}>
        <span aria-hidden="true">☁</span> WEATHER
      </button>
      {open && <div role="dialog" aria-label="Weather controls" style={{ position: "absolute", top: 34, right: 0,
        width: 340, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 80px)", overflowY: "auto",
        background: "rgba(6,9,18,0.97)", border: "1px solid rgba(34,211,238,0.25)", borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        <button type="button" aria-label="Close weather controls" onClick={() => setOpen(false)}
          style={{ position: "absolute", top: 12, right: 10, color: "#94a3b8", background: "none", border: 0, cursor: "pointer" }}>✕</button>
        <WeatherDetailPanel enabled={enabled} onEnabledChange={onEnabledChange} {...controls} />
      </div>}
    </div>
  );
}

export function WeatherDetailPanel({ enabled, onEnabledChange, ...controls }: WeatherControlsProps & {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
}) {
  return (
    <div id="weather-detail-panel" role="region" aria-label="Weather details" style={{ padding: 14, overflowY: "auto", flex: 1, minHeight: 0, color: "#cbd5e1", fontFamily: FONT_SANS }}>
      <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Weather & forecasts</div>
      <label style={{ ...rowStyle, color: "#a5f3fc", fontSize: 12, marginBottom: 10 }}>
        <input type="checkbox" checked={enabled} onChange={e => onEnabledChange(e.target.checked)} style={{ accentColor: "#22d3ee" }} />
        <span>Satellite clouds</span>
      </label>
      {enabled && <WeatherImageryControls {...controls} />}
      <CycloneForecastControls {...controls} />
    </div>
  );
}

export default function WeatherImageryControls({ weather, opacity, onOpacityChange, enhanced, onEnhancedChange }: WeatherControlsProps) {
  const manifest = weather.frame?.manifest;
  const observed = manifest ? new Date(manifest.observedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC" : null;
  const selectedIndex = weather.selectedId ? weather.history.findIndex(f => f.frameId === weather.selectedId) : weather.history.length - 1;
  const status = weather.loading && !manifest ? "Loading" : manifest ? weather.freshness === "stale" ? "Delayed" : "Available" : "Unavailable";
  return (
    <div style={{ fontSize: 11, lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10 }} aria-live="polite">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: "#cbd5e1" }}>
        <span>NOAA + NASA infrared</span>
        <span style={{ color: weather.freshness === "stale" ? "#fbbf24" : "#94a3b8" }}>{status}</span>
      </div>
      {observed && <div style={{ color: "#94a3b8", marginTop: 2 }}>Observed {observed}</div>}
      {weather.error && <div role="status" style={{ color: "#fbbf24", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{manifest ? "Update failed; showing last image." : "Satellite imagery unavailable."}</span>
        <button type="button" onClick={weather.retry} style={quietButton}>Retry</button>
      </div>}
      {manifest && <>
        {weather.freshness === "stale" && <div role="status" style={{ color: "#fbbf24", marginTop: 3 }}>Latest image is delayed.</div>}
        {weather.history.length > 1 && <details style={{ marginTop: 9 }}>
          <summary style={{ cursor: "pointer", color: "#cbd5e1" }}>Time lapse</summary>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7 }}>
            <button type="button" aria-label={weather.playing ? "Pause weather animation" : "Play weather animation"}
              disabled={weather.history.length < 2} onClick={weather.togglePlayback}
              style={{ ...quietButton, opacity: weather.history.length < 2 ? 0.45 : 1 }}>{weather.playing ? "Pause" : "Play"}</button>
            <button type="button" onClick={() => weather.selectFrame(null)} style={quietButton}>Latest</button>
            <label style={{ marginLeft: "auto" }}>Speed <select aria-label="Weather playback speed" value={weather.playbackRate}
              onChange={e => weather.setPlaybackRate(Number(e.target.value))} style={{ ...quietButton, marginLeft: 4 }}>
              {[0.5, 1, 2, 4].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
            </select></label>
          </div>
          <input type="range" aria-label="Weather history timeline" min="0" max={weather.history.length - 1} step="1"
            value={Math.max(0, selectedIndex)} onChange={e => weather.selectFrame(weather.history[Number(e.target.value)].frameId)}
            style={{ width: "100%", accentColor: "#22d3ee", marginTop: 7 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8" }}>
            <span>{new Date(weather.history[0].observedAt).toISOString().slice(5, 16).replace("T", " ")} UTC</span><span>Latest</span>
          </div>
        </details>}
        <details style={{ marginTop: 9 }}>
          <summary style={{ cursor: "pointer", color: "#cbd5e1" }}>Display options & sources</summary>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            Opacity
            <input aria-label="Satellite imagery opacity" type="range" min="0" max="1" step="0.05" value={opacity}
              onChange={e => onOpacityChange(Number(e.target.value))} style={{ flex: 1, accentColor: "#22d3ee" }} />
            <span>{Math.round(opacity * 100)}%</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
            <input type="checkbox" aria-label="Enhanced infrared colours" checked={enhanced} onChange={e => onEnhancedChange(e.target.checked)} />
            Enhanced infrared colours
          </label>
          <div style={{ marginTop: 5, color: "#94a3b8" }}>Infrared brightness · no temperature scale</div>
          {weather.frame?.polar && <div style={{ marginTop: 5, color: "#94a3b8" }}>Polar composite: {weather.frame.polar.manifest.observedDate} UTC</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <a href="https://registry.opendata.aws/noaa-gmgsi/" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>NOAA ↗</a>
            {weather.frame?.polar && <a href="https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>NASA ↗</a>}
          </div>
        </details>
      </>}
    </div>
  );
}
