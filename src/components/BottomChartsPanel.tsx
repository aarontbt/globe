import React, { useState } from "react";
import volatilityData from "../data/charts-volatility.json";

const entries = volatilityData.days;
const DAYS     = entries.map(d => d.day);
const OVX      = entries.map(d => d.ovx);
const SCENARIOS = entries.map(d => d.scenarios as [number, number, number]);
const ITRAXX   = entries.map(d => d.itraxx);
const OVX_CONFIRMED = entries.map(d => d.ovxConfirmed);

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', pointerEvents: 'all', cursor: 'default' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 12, height: 12, borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.25)',
        fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.4)',
        lineHeight: 1, userSelect: 'none',
      }}>?</span>
      {visible && (
        <span style={{
          position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(6,9,26,0.97)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, padding: '6px 8px', width: 190, zIndex: 100,
          fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.75)',
          lineHeight: 1.5, whiteSpace: 'normal', pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

const W = 185;
const H = 60;

const cardStyle: React.CSSProperties = {
  background: 'rgba(6,9,26,0.75)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 12px',
  width: 210,
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'rgba(255,255,255,0.4)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const valueStyle = (color: string): React.CSSProperties => ({
  fontFamily: 'monospace',
  fontSize: 14,
  fontWeight: 700,
  color,
});

function makePolyline(data: number[], minVal: number, maxVal: number): string {
  return data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - minVal) / (maxVal - minVal)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function makeAreaPath(data: number[], minVal: number, maxVal: number): string {
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - minVal) / (maxVal - minVal)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts[0]} L${pts.join(' L')} L${W},${H} L0,${H} Z`;
}

function DayAxis() {
  const ticks = [0, 5, 10];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
      {ticks.map(i => (
        <span key={i} style={{ ...labelStyle, fontSize: 9 }}>{DAYS[i]}</span>
      ))}
    </div>
  );
}

function OVXChart() {
  const minVal = 0;
  const maxVal = 130;
  const currentVal = OVX[OVX.length - 1];
  const currentConfirmed = OVX_CONFIRMED[OVX_CONFIRMED.length - 1];
  const peakIdx = OVX.indexOf(Math.max(...OVX));
  const peakX = (peakIdx / (OVX.length - 1)) * W;
  const peakY = H - ((OVX[peakIdx] - minVal) / (maxVal - minVal)) * H;
  const currentColor = currentVal < 80 ? '#4ade80' : '#f59e0b';
  const gradId = 'ovx-grad';

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={labelStyle}>OVX Implied Vol</span>
          <InfoTooltip text="30-day implied volatility on crude oil options. Higher readings mean markets expect larger Brent price swings." />
        </span>
        <span style={valueStyle(currentColor)}>
          {currentVal.toFixed(1)}{!currentConfirmed && <span style={{ fontSize: 9, opacity: 0.5 }}> est</span>}
        </span>
      </div>
      <svg width={W} height={H} overflow="visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={makeAreaPath(OVX, minVal, maxVal)} fill={`url(#${gradId})`} />
        {/* Dashed segment for estimated final point */}
        {!currentConfirmed && (() => {
          const n = OVX.length;
          const x1 = ((n - 2) / (n - 1)) * W;
          const y1 = H - ((OVX[n - 2] - minVal) / (maxVal - minVal)) * H;
          const x2 = W;
          const y2 = H - ((OVX[n - 1] - minVal) / (maxVal - minVal)) * H;
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />;
        })()}
        <polyline
          points={makePolyline(OVX.slice(0, OVX_CONFIRMED.lastIndexOf(true) + 1), minVal, maxVal)}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Peak dot */}
        <circle cx={peakX} cy={peakY} r={3} fill="#f59e0b" />
        <text x={peakX} y={peakY - 5} fontSize={8} fill="rgba(255,255,255,0.5)" textAnchor="middle">
          {OVX[peakIdx].toFixed(0)}
        </text>
        {/* Final dot */}
        {(() => {
          const finalY = H - ((currentVal - minVal) / (maxVal - minVal)) * H;
          return <circle cx={W} cy={finalY} r={3} fill={currentColor} opacity={currentConfirmed ? 1 : 0.6} />;
        })()}
      </svg>
      <DayAxis />
    </div>
  );
}

function ScenarioChart() {
  const barH = H / SCENARIOS.length;
  const colors = ['#4ade80', '#f59e0b', '#f87171'];
  const labels = ['Base', 'Stress', 'Tail'];
  const current = SCENARIOS[SCENARIOS.length - 1];

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={labelStyle}>Scenario Probs</span>
          <InfoTooltip text="Analyst probability split across Base (de-escalation), Stress (prolonged closure) and Tail (regional war). Each row sums to 100%." />
        </span>
        <span style={{ ...labelStyle, fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>
          B{current[0]} S{current[1]} T{current[2]}
        </span>
      </div>
      <svg width={W} height={H}>
        {SCENARIOS.map((row, i) => {
          let x = 0;
          return (
            <g key={i}>
              {row.map((pct, j) => {
                const w = (pct / 100) * W;
                const rect = (
                  <rect
                    key={j}
                    x={x}
                    y={i * barH + 0.5}
                    width={w}
                    height={barH - 1}
                    fill={colors[j]}
                    opacity={i === SCENARIOS.length - 1 ? 0.85 : 0.45}
                  />
                );
                x += w;
                return rect;
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {labels.map((lbl, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors[i] }} />
            <span style={{ ...labelStyle, fontSize: 9 }}>{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ITraxxChart() {
  const minVal = 50;
  const maxVal = 200;
  const currentVal = ITRAXX[ITRAXX.length - 1];
  const peakVal = Math.max(...ITRAXX);
  const peakIdx = ITRAXX.indexOf(peakVal);
  const peakX = (peakIdx / (ITRAXX.length - 1)) * W;
  const peakY = H - ((peakVal - minVal) / (maxVal - minVal)) * H;
  const gradId = 'itraxx-grad';
  const dropFromPeak = peakVal - currentVal;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={labelStyle}>iTraxx Asia IG</span>
          <InfoTooltip text="CDS spread index across 40 Asian investment-grade names. Wider spreads signal higher perceived default risk." />
        </span>
        <span style={valueStyle('#a78bfa')}>{currentVal} bps</span>
      </div>
      <svg width={W} height={H} overflow="visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={makeAreaPath(ITRAXX, minVal, maxVal)} fill={`url(#${gradId})`} />
        <polyline
          points={makePolyline(ITRAXX, minVal, maxVal)}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Peak annotation top-left */}
        <text x={0} y={9} fontSize={8} fill="#4ade80" fontFamily="monospace">▼ -{dropFromPeak} from peak</text>
        {/* Peak dot */}
        <circle cx={peakX} cy={peakY} r={3} fill="#a78bfa" />
        <text x={peakX + 2} y={peakY - 4} fontSize={8} fill="rgba(255,255,255,0.5)" textAnchor="middle">
          {peakVal}
        </text>
        {/* Final dot */}
        {(() => {
          const finalY = H - ((currentVal - minVal) / (maxVal - minVal)) * H;
          return <circle cx={W} cy={finalY} r={3} fill="#a78bfa" />;
        })()}
      </svg>
      <DayAxis />
    </div>
  );
}

export default function BottomChartsPanel() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      <OVXChart />
      <ScenarioChart />
      <ITraxxChart />
    </div>
  );
}
