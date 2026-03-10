import React, { useState, useEffect } from "react";
import volatilityData from "../data/charts-volatility.json";

const entries = volatilityData.days;
const DAYS     = entries.map(d => d.day);
const BASE_OVX = entries.map(d => d.ovx);
const SCENARIOS = entries.map(d => d.scenarios as [number, number, number]);
const BASE_VXEEM = entries.map(d => d.vxeem);
const BASE_OVX_CONFIRMED = entries.map(d => d.ovxConfirmed);
const BASE_VXEEM_CONFIRMED = entries.map(d => d.vxeemConfirmed);

interface OVXLiveData {
  price: number | null;
  change: number | null;
  changePct: number | null;
  loading: boolean;
  error: boolean;
}

function useOVXLive(url: string = "/api/cboe/api/global/us_indices/daily_prices/OVX_History.csv"): OVXLiveData {
  const [data, setData] = useState<OVXLiveData>({ price: null, change: null, changePct: null, loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    const fetch_ = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const lines = text.trim().split("\n").filter(l => l && !l.startsWith("DATE"));
        if (lines.length < 2) throw new Error("insufficient data");
        const parseClose = (line: string) => {
          const parts = line.split(",");
          // VXEEM has OPEN,HIGH,LOW,CLOSE (4 cols after DATE); OVX has just CLOSE (1 col)
          return parseFloat(parts[parts.length - 1]);
        };
        const price = parseClose(lines[lines.length - 1]);
        const prev = parseClose(lines[lines.length - 2]);
        const change = +(price - prev).toFixed(2);
        const changePct = +((price - prev) / prev * 100).toFixed(2);
        if (!cancelled) setData({ price, change, changePct, loading: false, error: false });
      } catch {
        if (!cancelled) setData(d => ({ ...d, loading: false, error: true }));
      }
    };
    fetch_();
    return () => { cancelled = true; };
  }, [url]);

  return data;
}

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
  const live = useOVXLive();
  const minVal = 0;
  const maxVal = 130;

  // Merge live price into last slot if available
  const OVX = live.price !== null
    ? [...BASE_OVX.slice(0, -1), live.price]
    : BASE_OVX;
  const OVX_CONFIRMED = live.price !== null
    ? [...BASE_OVX_CONFIRMED.slice(0, -1), true]
    : BASE_OVX_CONFIRMED;

  const currentVal = OVX[OVX.length - 1];
  const currentConfirmed = OVX_CONFIRMED[OVX_CONFIRMED.length - 1];
  const isLive = live.price !== null && !live.error;
  const peakIdx = OVX.indexOf(Math.max(...OVX));
  const peakX = (peakIdx / (OVX.length - 1)) * W;
  const peakY = H - ((OVX[peakIdx] - minVal) / (maxVal - minVal)) * H;
  const currentColor = currentVal < 80 ? '#4ade80' : '#f59e0b';
  const gradId = 'ovx-grad';

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={labelStyle}>^OVX Vol</span>
          <InfoTooltip text="30-day implied volatility on crude oil options. Higher readings mean markets expect larger Brent price swings." />
        </span>
        <span style={valueStyle(currentColor)}>
          {currentVal.toFixed(1)}
          {isLive && live.changePct !== null && (
            <span style={{ fontSize: 9, color: live.changePct >= 0 ? '#f87171' : '#4ade80', marginLeft: 3 }}>
              {live.changePct >= 0 ? '+' : ''}{live.changePct.toFixed(1)}%
            </span>
          )}
          {!currentConfirmed && !isLive && <span style={{ fontSize: 9, opacity: 0.5 }}> est</span>}
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

function VXEEMChart() {
  const live = useOVXLive(
    "/api/cboe/api/global/us_indices/daily_prices/VXEEM_History.csv"
  );
  const minVal = 15;
  const maxVal = 50;

  const VXEEM = live.price !== null
    ? [...BASE_VXEEM.slice(0, -1), live.price]
    : BASE_VXEEM;
  const VXEEM_CONFIRMED = live.price !== null
    ? [...BASE_VXEEM_CONFIRMED.slice(0, -1), true]
    : BASE_VXEEM_CONFIRMED;

  const currentVal = VXEEM[VXEEM.length - 1];
  const currentConfirmed = VXEEM_CONFIRMED[VXEEM_CONFIRMED.length - 1];
  const peakVal = Math.max(...VXEEM);
  const peakIdx = VXEEM.indexOf(peakVal);
  const peakX = (peakIdx / (VXEEM.length - 1)) * W;
  const peakY = H - ((peakVal - minVal) / (maxVal - minVal)) * H;
  const gradId = 'vxeem-grad';
  const dropFromPeak = (peakVal - currentVal).toFixed(1);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={labelStyle}>VXEEM EM Vol</span>
          <InfoTooltip text="CBOE Emerging Markets ETF Volatility Index. Spikes signal heightened fear across EM/ASEAN assets." />
        </span>
        <span style={valueStyle('#a78bfa')}>
          {currentVal.toFixed(1)}
          {live.price !== null && live.changePct !== null && (
            <span style={{ fontSize: 9, color: live.changePct >= 0 ? '#f87171' : '#4ade80', marginLeft: 3 }}>
              {live.changePct >= 0 ? '+' : ''}{live.changePct.toFixed(1)}%
            </span>
          )}
          {!currentConfirmed && live.price === null && <span style={{ fontSize: 9, opacity: 0.5 }}> est</span>}
        </span>
      </div>
      <svg width={W} height={H} overflow="visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={makeAreaPath(VXEEM, minVal, maxVal)} fill={`url(#${gradId})`} />
        {!currentConfirmed && live.price === null && (() => {
          const n = VXEEM.length;
          const x1 = ((n - 2) / (n - 1)) * W;
          const y1 = H - ((VXEEM[n - 2] - minVal) / (maxVal - minVal)) * H;
          const x2 = W;
          const y2 = H - ((VXEEM[n - 1] - minVal) / (maxVal - minVal)) * H;
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="3 2" />;
        })()}
        <polyline
          points={makePolyline(VXEEM.slice(0, VXEEM_CONFIRMED.lastIndexOf(true) + 1), minVal, maxVal)}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text x={0} y={9} fontSize={8} fill="#4ade80" fontFamily="monospace">▼ -{dropFromPeak} from peak</text>
        <circle cx={peakX} cy={peakY} r={3} fill="#a78bfa" />
        <text x={peakX} y={peakY - 5} fontSize={8} fill="rgba(255,255,255,0.5)" textAnchor="middle">
          {peakVal.toFixed(1)}
        </text>
        {(() => {
          const finalY = H - ((currentVal - minVal) / (maxVal - minVal)) * H;
          return <circle cx={W} cy={finalY} r={3} fill="#a78bfa" opacity={currentConfirmed ? 1 : 0.6} />;
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
      <VXEEMChart />
    </div>
  );
}
