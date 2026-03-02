import { useState } from "react";
import type { NewsArticle } from "../types";

interface Props {
  articles: NewsArticle[];
  loading: boolean;
  cacheAge: number | null; // ms since last fetch; null = live data
  onRefresh: () => Promise<boolean>;
}

const SOURCE_COLORS: Record<NewsArticle["source"], { bg: string; text: string }> = {
  CNA:          { bg: "rgba(251,146,60,0.18)",  text: "#fb923c" },
  BBC:          { bg: "rgba(239,68,68,0.18)",   text: "#f87171" },
  Reuters:      { bg: "rgba(96,165,250,0.18)",  text: "#60a5fa" },
  CNBC:         { bg: "rgba(34,211,238,0.18)",  text: "#22d3ee" },
  "Al Jazeera": { bg: "rgba(226,232,240,0.1)",  text: "#e2e8f0" },
};

function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function timeAgo(pubDate: string): string {
  const diff = Math.max(0, Date.now() - new Date(pubDate).getTime());
  const secs = Math.floor(diff / 1000);
  if (secs < 60)    return "now";
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function formatCacheAge(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

type ToastState = "success" | "error" | null;

export default function NewsWidget({ articles, loading, cacheAge, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  async function handleRefresh() {
    if (refreshing || loading) return;
    setRefreshing(true);
    const ok = await onRefresh();
    setRefreshing(false);
    setToast(ok ? "success" : "error");
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div style={{
      width: "100%",
      height: "100%",
      fontFamily: "system-ui, -apple-system, sans-serif",
      background: "rgba(10,14,23,0.88)",
      backdropFilter: "blur(12px)",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          padding: "6px 14px",
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          background: toast === "error"
            ? "rgba(239,68,68,0.22)"
            : "rgba(34,211,238,0.18)",
          color: toast === "error" ? "#f87171" : "#22d3ee",
          border: `1px solid ${toast === "error" ? "rgba(239,68,68,0.3)" : "rgba(34,211,238,0.25)"}`,
          backdropFilter: "blur(8px)",
        }}>
          {toast === "error" ? "Feed unavailable — check connection" : "Feed refreshed"}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em" }}>
          INTELLIGENCE FEED
        </span>
        {!loading && articles.length > 0 && (
          cacheAge !== null ? (
            <span
              onClick={handleRefresh}
              title="Click to refresh"
              style={{
                fontSize: 10, fontWeight: 600,
                color: refreshing ? "rgba(251,146,60,0.5)" : "#fb923c",
                background: "rgba(251,146,60,0.12)",
                padding: "1px 7px",
                borderRadius: 10,
                cursor: refreshing ? "default" : "pointer",
                userSelect: "none",
                transition: "opacity 0.2s",
              }}
            >
              {refreshing ? "···" : `cached ${formatCacheAge(cacheAge)}`}
            </span>
          ) : (
            <span
              onClick={handleRefresh}
              title="Click to force refresh"
              style={{
                fontSize: 10, fontWeight: 600,
                color: refreshing ? "rgba(34,211,238,0.5)" : "#22d3ee",
                background: "rgba(34,211,238,0.12)",
                padding: "1px 7px",
                borderRadius: 10,
                cursor: refreshing ? "default" : "pointer",
                userSelect: "none",
                transition: "opacity 0.2s",
              }}
            >
              {refreshing ? "···" : "LIVE"}
            </span>
          )
        )}
      </div>

      {/* Article list — fills remaining height, scrolls internally */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.1) transparent",
      }}>
        {loading && articles.length === 0 ? (
          <div style={{ padding: "12px 14px", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            Loading…
          </div>
        ) : (
          articles.slice(0, 10).map((article, i) => {
            const srcStyle = SOURCE_COLORS[article.source] ?? SOURCE_COLORS["Reuters"];
            return (
              <div
                key={`${article.link}-${i}`}
                onClick={() => window.open(article.link, "_blank")}
                style={{
                  padding: "8px 14px",
                  borderBottom: i < articles.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: srcStyle.text,
                    background: srcStyle.bg,
                    padding: "1px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.06em",
                  }}>
                    {linkDomain(article.link)}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                    {timeAgo(article.pubDate)}
                  </span>
                </div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.4,
                }}>
                  {article.title}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
