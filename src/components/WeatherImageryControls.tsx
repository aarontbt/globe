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
      {open && <div role="dialog" aria-label="Weather details" style={{ position: "absolute", top: 34, right: 0,
        width: 294, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 80px)", overflowY: "auto",
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
    <div id="weather-detail-panel" role="region" aria-label="Weather details" style={{ padding: 14, overflowY: "auto", flex: 1, minHeight: 0 }}>
      <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Weather & forecasts</div>
      <div style={{ color: "#94a3b8", fontSize: 10, lineHeight: 1.5, marginBottom: 12 }}>Satellite observations and official tropical cyclone forecasts.</div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#a5f3fc", fontSize: 11, marginBottom: 12 }}>
        <input type="checkbox" checked={enabled} onChange={e => onEnabledChange(e.target.checked)} style={{ accentColor: "#22d3ee" }} />
        Weather clouds
      </label>
      {enabled ? <WeatherImageryControls {...controls} /> : <div style={{ color: "#94a3b8", fontSize: 11 }}>Enable weather clouds to show satellite imagery on the globe.</div>}
      <CycloneForecastControls {...controls} />
    </div>
  );
}

export default function WeatherImageryControls({ weather, opacity, onOpacityChange, enhanced, onEnhancedChange }: WeatherControlsProps) {
  const manifest = weather.frame?.manifest;
  const observed = manifest ? new Date(manifest.observedAt).toISOString().replace("T", " ").replace(":00.000Z", " UTC") : null;
  const selectedIndex = weather.selectedId ? weather.history.findIndex(f => f.frameId === weather.selectedId) : weather.history.length - 1;
  const buttonStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "3px 7px", color: "#a5f3fc", cursor: "pointer", fontSize: 10 };
  return (
    <div style={{ width: "100%", maxWidth: "100%", fontSize: 10, lineHeight: 1.5, color: "rgba(255,255,255,0.6)", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8 }} aria-live="polite">
      <div style={{ display: "flex", justifyContent: "space-between", color: "#a5f3fc" }}>
        <span>NOAA + NASA infrared</span>
        <span>{weather.loading ? "Loading…" : weather.historical ? "History" : weather.freshness === "fresh" ? "Recent" : weather.freshness === "stale" ? "Stale" : "Unavailable"}</span>
      </div>
      {observed && <div>Observed {observed} · ~8 km source</div>}
      <div>Hourly infrared; daily MODIS polar infrared.</div>
      {weather.error && <div role="status" style={{ color: "#fbbf24", marginTop: 4 }}>
        {manifest ? "Frame unavailable; showing last complete image." : "Satellite imagery is currently unavailable."}
        <button type="button" onClick={weather.retry} style={{ ...buttonStyle, marginLeft: 6 }}>Retry</button>
      </div>}
      {manifest && <>
        {weather.freshness === "stale" && <div style={{ color: "#fbbf24" }}>Latest observation is over two hours old.</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
          <label>History <select aria-label="Weather history range" value={weather.historyHours}
            onChange={e => weather.setHistoryHours(Number(e.target.value))} style={{ ...buttonStyle, marginLeft: 4 }}>
            {[6, 24, 48, 72].map(hours => <option key={hours} value={hours}>{hours}h</option>)}
          </select></label>
          <label>Speed <select aria-label="Weather playback speed" value={weather.playbackRate}
            onChange={e => weather.setPlaybackRate(Number(e.target.value))} style={{ ...buttonStyle, marginLeft: 4 }}>
            {[0.5, 1, 2, 4].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
          </select></label>
        </div>
        <div style={{ fontSize: 9, marginTop: 4 }}>{Math.round(weather.availableHours)}h of actual observations available</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7 }}>
          <button type="button" aria-label={weather.playing ? "Pause weather animation" : "Play weather animation"}
            disabled={weather.history.length < 2} onClick={weather.togglePlayback}
            style={{ ...buttonStyle, opacity: weather.history.length < 2 ? 0.4 : 1 }}>{weather.playing ? "Ⅱ Pause" : "▶ Play"}</button>
          <button type="button" onClick={() => weather.selectFrame(null)} style={buttonStyle}>Latest</button>
          <span>{weather.history.length > 1 ? `${weather.history.length} frames` : "History building"}</span>
        </div>
        {weather.history.length > 1 && <>
          <input type="range" aria-label="Weather history timeline" min="0" max={weather.history.length - 1} step="1"
            value={Math.max(0, selectedIndex)} onChange={e => weather.selectFrame(weather.history[Number(e.target.value)].frameId)}
            style={{ width: "100%", accentColor: "#22d3ee", marginTop: 6 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
            <span>{new Date(weather.history[0].observedAt).toISOString().slice(5, 16).replace("T", " ")} UTC</span><span>Latest</span>
          </div>
          <div>Observed time-lapse · cross-faded hourly steps</div>
        </>}
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          Opacity
          <input aria-label="Satellite imagery opacity" type="range" min="0" max="1" step="0.05" value={opacity}
            onChange={e => onOpacityChange(Number(e.target.value))} style={{ width: 120, accentColor: "#22d3ee" }} />
          {Math.round(opacity * 100)}%
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, color: "#cbd5e1" }}>
          <input type="checkbox" aria-label="Enhanced infrared colours" checked={enhanced} onChange={e => onEnhancedChange(e.target.checked)} />
          Enhanced infrared colours
        </label>
        <div style={{ background: enhanced ? "linear-gradient(to right, #151515, #fff 38%, #8ac9ef 55%, #ffe74c 70%, #f97316 83%, #e11d48 93%, #a30059)" : "linear-gradient(to right, #151515, #fff)", height: 5, marginTop: 7 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}><span>Lower brightness</span><span>Higher brightness</span></div>
        <div>{enhanced ? "Brightness colour enhancement · no temperature scale" : "Infrared brightness · contrast enhanced"}</div>
        <div style={{ marginTop: 5, fontSize: 9 }}>{manifest.attribution}</div>
        {weather.frame?.polar ? <div style={{ marginTop: 8, fontSize: 10, color: "#a5f3fc" }}>
          Poles: {weather.frame.polar.manifest.observedDate} UTC daily composite
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>{weather.frame.polar.manifest.attribution}</div>
        </div> : <div style={{ marginTop: 8, color: "#fbbf24" }}>Polar observations not available in this frame.</div>}
      </>}
      <a href="https://registry.opendata.aws/noaa-gmgsi/" target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>Source & attribution ↗</a>
    </div>
  );
}
