import { useMemo, useEffect, useRef, useState } from "react";
import type { MarketQuote } from "../types";

interface Props {
  quotes: MarketQuote[];
  loading: boolean;
  lastUpdated: Date | null;
}

const NEAR_TERM_RANGE = "85–100";
const SUSTAINED_PRICE = "120";
const TOP_ALERT = "Strait of Hormuz de facto closed — oil supply at critical risk";

const KEYFRAME_CSS = `
  @keyframes flashUp {
    0%   { background: rgba(74,222,128,0.30); }
    100% { background: transparent; }
  }
  @keyframes flashDown {
    0%   { background: rgba(248,113,113,0.30); }
    100% { background: transparent; }
  }
  @keyframes blinkDot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
  }
`;

function Sparkline({
  data,
  width = 72,
  height = 28,
  positive,
  id,
}: {
  data: number[];
  width?: number;
  height?: number;
  positive: boolean;
  id: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 1.5;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (height - pad * 2) - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "#4ade80" : "#f87171";
  const gradId = `sg-${id}`;
  const lastX = pad + (width - pad * 2);
  const lastPt = data[data.length - 1];
  const lastNormY = pad + (height - pad * 2) - ((lastPt - min) / range) * (height - pad * 2);
  return (
    <svg width={width} height={height} style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`${pad},${height} ${pts} ${lastX},${height}`}
        fill={`url(#${gradId})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastNormY} r={2.5} fill={color} />
    </svg>
  );
}

function TrendArrow({ change, changePct }: { change: number; changePct: number }) {
  const up = changePct >= 0;
  const color = up ? "#4ade80" : "#f87171";
  return (
    <span style={{ color, fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{change.toFixed(2)} ({up ? "+" : ""}{changePct.toFixed(2)}%)
    </span>
  );
}

type FlashDir = "up" | "down" | null;

function QuoteRow({
  quote,
  size = "large",
  priceDecimals = 2,
}: {
  quote: MarketQuote;
  size?: "large" | "small";
  priceDecimals?: number;
}) {
  const prevPrice = useRef<number>(quote.price);
  const [flash, setFlash] = useState<FlashDir>(null);
  const sessionHigh = useRef<number>(quote.price);
  const sessionLow = useRef<number>(quote.price);

  // Track session high/low
  useEffect(() => {
    if (quote.price > sessionHigh.current) sessionHigh.current = quote.price;
    if (quote.price < sessionLow.current) sessionLow.current = quote.price;
  }, [quote.price]);

  // Flash on price change
  useEffect(() => {
    const diff = quote.price - prevPrice.current;
    if (Math.abs(diff) > 0.001) {
      setFlash(diff > 0 ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 400);
      prevPrice.current = quote.price;
      return () => clearTimeout(t);
    }
  }, [quote.price]);

  const up = quote.changePct >= 0;
  const priceColor = up ? "#4ade80" : "#f87171";
  const isLarge = size === "large";

  // Simulated bid/ask spread (0.01–0.02% of price)
  const spread = quote.price * 0.00012;
  const bid = quote.price - spread;
  const ask = quote.price + spread;

  const flashStyle: React.CSSProperties = flash
    ? {
        animation: `${flash === "up" ? "flashUp" : "flashDown"} 400ms ease-out forwards`,
        borderRadius: 4,
        margin: "0 -4px",
        padding: "0 4px",
      }
    : {};

  return (
    <div style={{ marginBottom: isLarge ? 10 : 6 }}>
      {/* Price row with sparkline */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <div style={flashStyle}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 2 }}>
            {quote.name}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{
              fontSize: isLarge ? 21 : 16,
              fontWeight: 700,
              color: "#fff",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.5px",
            }}>
              ${quote.price.toFixed(priceDecimals)}
            </span>
          </div>
          <div style={{ marginTop: 1 }}>
            <TrendArrow change={quote.change} changePct={quote.changePct} />
          </div>
        </div>
        {quote.history && (
          <Sparkline
            data={quote.history}
            width={isLarge ? 72 : 60}
            height={isLarge ? 30 : 24}
            positive={up}
            id={quote.symbol}
          />
        )}
      </div>

      {/* Bid / Ask / H / L */}
      <div style={{
        display: "flex",
        gap: 10,
        marginTop: 3,
        fontSize: 9,
        fontVariantNumeric: "tabular-nums",
      }}>
        <span>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>BID </span>
          <span style={{ color: "#4ade80" }}>{bid.toFixed(priceDecimals)}</span>
        </span>
        <span>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>ASK </span>
          <span style={{ color: "#f87171" }}>{ask.toFixed(priceDecimals)}</span>
        </span>
        <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
          H {sessionHigh.current.toFixed(priceDecimals)} · L {sessionLow.current.toFixed(priceDecimals)}
        </span>
      </div>
    </div>
  );
}

function AlertStrip({ text }: { text: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      {hovered && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: 0,
          right: 0,
          background: "rgba(15,10,10,0.97)",
          border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 6,
          padding: "7px 10px",
          fontSize: 9,
          color: "rgba(255,255,255,0.75)",
          lineHeight: 1.55,
          zIndex: 50,
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
        }}>
          <span style={{ color: "#f87171", fontWeight: 800, letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>
            ▲ RED ALERT
          </span>
          {text}
        </div>
      )}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "4px 14px 4px 10px",
          background: hovered ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.08)",
          borderBottom: "1px solid rgba(239,68,68,0.15)",
          borderLeft: "2px solid #ef4444",
          display: "flex",
          alignItems: "center",
          gap: 5,
          overflow: "hidden",
          cursor: "default",
          transition: "background 150ms",
        }}>
        <span style={{ fontSize: 8, color: "#f87171", fontWeight: 800, letterSpacing: "0.06em", flexShrink: 0 }}>▲ RED ALERT</span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
      </div>
    </div>
  );
}

export default function MarketsWidget({ quotes, loading, lastUpdated }: Props) {
  useEffect(() => {
    if (document.getElementById("mkt-flash-kf")) return;
    const style = document.createElement("style");
    style.id = "mkt-flash-kf";
    style.textContent = KEYFRAME_CSS;
    document.head.appendChild(style);
  }, []);

  const brent = useMemo(() => quotes.find(q => q.symbol === "BZ=F"), [quotes]);
  const lng   = useMemo(() => quotes.find(q => q.symbol === "NG=F"), [quotes]);
  const gold  = useMemo(() => quotes.find(q => q.symbol === "GC=F"), [quotes]);

  // Tick counter
  const tickCount = useRef(0);
  const [displayTicks, setDisplayTicks] = useState(0);
  useEffect(() => {
    if (lastUpdated) {
      tickCount.current += 1;
      setDisplayTicks(tickCount.current);
    }
  }, [lastUpdated]);

  // Elapsed since last update (re-renders every second)
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const isLive = lastUpdated !== null && elapsed < 30;

  const panelStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "'SF Mono', 'Roboto Mono', 'Consolas', monospace",
    background: "rgba(8,12,20,0.92)",
    backdropFilter: "blur(14px)",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    overflow: "hidden",
  };

  const sectionStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 14px 7px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.02)",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.1em" }}>
          LIVE MARKETS
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontVariantNumeric: "tabular-nums" }}>
            {displayTicks.toLocaleString()} ticks
          </span>
          {isLive && (
            <>
              <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)" }} />
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#4ade80",
                boxShadow: "0 0 6px #4ade80",
                animation: "blinkDot 1.5s ease-in-out infinite",
                display: "inline-block",
              }} />
              <span style={{ fontSize: 9, color: "#4ade80", fontWeight: 700, letterSpacing: "0.06em" }}>LIVE</span>
            </>
          )}
        </div>
      </div>

      {/* Prices */}
      <div style={sectionStyle}>
        {loading && !brent ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", padding: "6px 0" }}>Connecting…</div>
        ) : (
          <>
            {brent && <QuoteRow quote={brent} size="large" priceDecimals={2} />}
            {lng   && <QuoteRow quote={lng}   size="small" priceDecimals={3} />}
            {gold  && <QuoteRow quote={gold}  size="small" priceDecimals={0} />}
          </>
        )}
      </div>

      {/* Alert strip */}
      <AlertStrip text={TOP_ALERT} />

      {/* Swarm Forecast */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#a78bfa", marginBottom: 6 }}>
          SWARM FORECAST
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Near-term target</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>${NEAR_TERM_RANGE}/bbl</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Sustained disruption</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#f87171", fontVariantNumeric: "tabular-nums" }}>${SUSTAINED_PRICE}/bbl</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Confidence</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80",
              background: "rgba(74,222,128,0.12)", padding: "1px 7px", borderRadius: 3 }}>
              HIGH
            </span>
          </div>
          <div style={{ marginTop: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Disruption probability</span>
              <span style={{ fontSize: 9, color: "#a78bfa", fontWeight: 700 }}>85%</span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
              <div style={{
                height: "100%", width: "85%",
                background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
                borderRadius: 2,
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "5px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontVariantNumeric: "tabular-nums" }}>
          ⏱ {elapsed === 0 ? "just now" : `${elapsed}s ago`}
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
          ~1.5s feed
        </span>
      </div>
    </div>
  );
}
