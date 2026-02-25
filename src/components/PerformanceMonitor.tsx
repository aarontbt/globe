import { useEffect, useRef, useState } from "react";

const HISTORY = 120;
const DRAW_INTERVAL_MS = 150;
const GRAPH_W = 118;
const GRAPH_H = 32;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function drawSparkline(
  canvas: HTMLCanvasElement,
  buf: Float32Array,
  count: number,
  lo: number,
  hi: number,
  color: string
) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const w = GRAPH_W, h = GRAPH_H;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const n = Math.min(count, HISTORY);
  if (n < 2) return;

  const range = hi - lo || 1;
  const [r, g, b] = hexToRgb(color);

  // Subtle grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 0.5;
  for (const t of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(0, t * h);
    ctx.lineTo(w, t * h);
    ctx.stroke();
  }

  // Build point list from ring buffer
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const idx = (count - n + i) % HISTORY;
    const v = Math.max(lo, Math.min(hi, buf[idx]));
    pts.push([
      (i / (n - 1)) * w,
      h - ((v - lo) / range) * (h - 3) - 1,
    ]);
  }

  // Filled area
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.lineTo(pts[pts.length - 1][0], h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = `rgba(${r},${g},${b},0.85)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Dot at latest reading
  const [lx, ly] = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(lx, ly, 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fill();
}

function getColor(val: number, warn: number, crit: number, lowerIsBetter: boolean): string {
  if (lowerIsBetter) {
    if (val >= crit) return "#ef4444";
    if (val >= warn) return "#f59e0b";
  } else {
    if (val <= crit) return "#ef4444";
    if (val <= warn) return "#f59e0b";
  }
  return "#22d3ee";
}

interface MetricRowProps {
  label: string;
  value: string;
  color: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

function MetricRow({ label, value, color, canvasRef }: MetricRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.38)",
          width: 58,
          flexShrink: 0,
          textAlign: "right",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
      <canvas ref={canvasRef} style={{ borderRadius: 3, flexShrink: 0 }} />
      <span
        style={{
          fontSize: 11,
          color,
          width: 52,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontFamily: "ui-monospace, monospace",
          transition: "color 0.3s",
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface Props {
  /** Ref written to by GlobeView's onBeforeRender/onAfterRender — no setState needed */
  deckRenderMsRef: React.MutableRefObject<number>;
}

export default function PerformanceMonitor({ deckRenderMsRef }: Props) {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  // Ring buffers (never reset — accumulate even when panel is closed)
  const fpsBuf    = useRef(new Float32Array(HISTORY));
  const frameBuf  = useRef(new Float32Array(HISTORY));
  const glBuf     = useRef(new Float32Array(HISTORY));
  const heapBuf   = useRef(new Float32Array(HISTORY));
  const countRef  = useRef(0);
  const lastRafRef = useRef(0);
  const lastDrawRef = useRef(0);

  // Canvas element refs
  const fpsCvs   = useRef<HTMLCanvasElement>(null) as React.MutableRefObject<HTMLCanvasElement>;
  const frameCvs = useRef<HTMLCanvasElement>(null) as React.MutableRefObject<HTMLCanvasElement>;
  const glCvs    = useRef<HTMLCanvasElement>(null) as React.MutableRefObject<HTMLCanvasElement>;
  const heapCvs  = useRef<HTMLCanvasElement>(null) as React.MutableRefObject<HTMLCanvasElement>;

  const [display, setDisplay] = useState({
    fps: "—", frame: "—", gl: "—", heap: "—",
    fpsColor: "#22d3ee", frameColor: "#22d3ee", glColor: "#22d3ee", heapColor: "#a78bfa",
  });

  const rafRef = useRef(0);

  useEffect(() => {
    const animate = (time: number) => {
      if (lastRafRef.current > 0) {
        const delta = time - lastRafRef.current;
        const idx = countRef.current % HISTORY;

        fpsBuf.current[idx]   = 1000 / delta;
        frameBuf.current[idx] = delta;
        glBuf.current[idx]    = deckRenderMsRef.current;

        const mem = (performance as any).memory;
        heapBuf.current[idx] = mem ? mem.usedJSHeapSize / 1_048_576 : 0;

        countRef.current++;

        // Only draw & update state when panel is open + enough time has passed
        if (expandedRef.current && time - lastDrawRef.current >= DRAW_INTERVAL_MS) {
          const count = countRef.current;
          const last  = (count - 1) % HISTORY;

          const curFps   = fpsBuf.current[last];
          const curFrame = frameBuf.current[last];
          const curGl    = glBuf.current[last];
          const curHeap  = heapBuf.current[last];

          const fpsColor   = getColor(curFps,   25, 15,  false);
          const frameColor = getColor(curFrame, 40, 66,  true);
          const glColor    = getColor(curGl,    16, 33,  true);
          const heapColor  = "#a78bfa";

          // Draw sparklines
          if (fpsCvs.current)   drawSparkline(fpsCvs.current,   fpsBuf.current,   count,  0,  65,  fpsColor);
          if (frameCvs.current) drawSparkline(frameCvs.current, frameBuf.current, count,  0, 100,  frameColor);
          if (glCvs.current)    drawSparkline(glCvs.current,    glBuf.current,    count,  0,  50,  glColor);
          if (heapCvs.current)  drawSparkline(heapCvs.current,  heapBuf.current,  count,  0, 500,  heapColor);

          setDisplay({
            fps:   curFps.toFixed(1),
            frame: curFrame.toFixed(1) + " ms",
            gl:    curGl > 0.1 ? curGl.toFixed(1) + " ms" : "—",
            heap:  mem ? curHeap.toFixed(0) + " MB" : "N/A",
            fpsColor, frameColor, glColor, heapColor,
          });

          lastDrawRef.current = time;
        }
      }
      lastRafRef.current = time;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // intentionally empty — uses refs throughout

  const panelBase: React.CSSProperties = {
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  if (!expanded) {
    return (
      <div style={panelBase}>
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: "rgba(8,12,22,0.88)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "5px 11px",
            color: "rgba(255,255,255,0.45)",
            fontSize: 10,
            letterSpacing: "0.16em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            backdropFilter: "blur(12px)",
          }}
        >
          <span style={{ color: "#22d3ee", fontSize: 8, lineHeight: 1 }}>◈</span>
          PERF
        </button>
      </div>
    );
  }

  return (
    <div style={panelBase}>
      <div
        style={{
          background: "rgba(6,9,18,0.93)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 12,
          padding: "12px 14px",
          backdropFilter: "blur(18px)",
          width: 264,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 11,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "#22d3ee", fontSize: 9 }}>◈</span>
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
              }}
            >
              Performance
            </span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.25)",
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Metric rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <MetricRow label="FPS"        value={display.fps}   color={display.fpsColor}   canvasRef={fpsCvs}   />
          <MetricRow label="Frame Time" value={display.frame} color={display.frameColor} canvasRef={frameCvs} />
          <MetricRow label="GL Render"  value={display.gl}    color={display.glColor}    canvasRef={glCvs}    />
          <MetricRow label="JS Heap"    value={display.heap}  color={display.heapColor}  canvasRef={heapCvs}  />
        </div>

        {/* Threshold legend */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 10,
            paddingTop: 9,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {(
            [
              ["#22d3ee", "Good"],
              ["#f59e0b", "Warn"],
              ["#ef4444", "Crit"],
            ] as const
          ).map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}
              />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em" }}>
                {label}
              </span>
            </div>
          ))}
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", marginLeft: "auto" }}>
            last {HISTORY} frames
          </span>
        </div>
      </div>
    </div>
  );
}
