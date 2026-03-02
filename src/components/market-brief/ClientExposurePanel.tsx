import { useState } from "react";
import clientData from "../../data/banker-clients.json";

const MONO = "'IBM Plex Mono', 'Courier New', monospace";
const CONDENSED = "'Barlow Condensed', system-ui, sans-serif";

const textPrimary = "rgba(255,255,255,0.9)";
const textSecondary = "rgba(255,255,255,0.5)";

const sectionHeader: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.28)",
  margin: 0,
  marginBottom: 8,
  fontFamily: CONDENSED,
};

function heatColor(score: number): { bg: string; fg: string } {
  if (score <= 3) return { bg: "rgba(52,211,153,0.10)", fg: "#34d399" };
  if (score <= 6) return { bg: "rgba(251,191,36,0.10)", fg: "#fbbf24" };
  return { bg: "rgba(248,113,113,0.12)", fg: "#f87171" };
}

const scenarioColors: Record<string, string> = {
  base: "#4ade80",
  stress: "#fbbf24",
  tail: "#ef4444",
};

const exposureKeys = ["energyCosts", "shipping", "sanctions", "refinancing"] as const;
const exposureLabels: Record<string, string> = {
  energyCosts: "Energy",
  shipping: "Shipping",
  sanctions: "Sanctions",
  refinancing: "Refi",
};

export default function ClientExposurePanel() {
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "rgba(10,14,23,0.88)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        padding: 20,
        color: textPrimary,
        overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.12) transparent",
      }}
    >
      <p style={sectionHeader}>Client Exposure Heatmap</p>

      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr repeat(4, 56px)",
          gap: 4,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontWeight: 700, fontFamily: CONDENSED, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Client
        </span>
        {exposureKeys.map((k) => (
          <span
            key={k}
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,0.28)",
              fontWeight: 700,
              textAlign: "center",
              fontFamily: CONDENSED,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {exposureLabels[k]}
          </span>
        ))}
      </div>

      {/* Client rows */}
      {clientData.clients.map((client) => {
        const isExpanded = expandedClientId === client.id;
        return (
          <div key={client.id} style={{ marginBottom: 2 }}>
            {/* Row */}
            <div
              onClick={() =>
                setExpandedClientId(isExpanded ? null : client.id)
              }
              style={{
                display: "grid",
                gridTemplateColumns: "1fr repeat(4, 56px)",
                gap: 4,
                padding: "8px 0",
                cursor: "pointer",
                borderBottom: isExpanded
                  ? "none"
                  : "1px solid rgba(255,255,255,0.04)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {client.name}
                </div>
                <div style={{ fontSize: 10, color: textSecondary }}>
                  {client.sector} &middot; {client.country}
                </div>
              </div>
              {exposureKeys.map((k) => {
                const score = client.exposure[k];
                const { bg, fg } = heatColor(score);
                return (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: bg,
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 700,
                      color: fg,
                      fontFamily: MONO,
                    }}
                  >
                    {score}
                  </div>
                );
              })}
            </div>

            {/* Expanded drill-down */}
            {isExpanded && (
              <div
                style={{
                  padding: "12px 0 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Scenario cards */}
                <p style={{ ...sectionHeader, marginBottom: 8 }}>
                  Scenario Impacts
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {(["base", "stress", "tail"] as const).map((s) => (
                    <div
                      key={s}
                      style={{
                        flex: 1,
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 8,
                        padding: 10,
                        borderTop: `2px solid ${scenarioColors[s]}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: scenarioColors[s],
                          marginBottom: 6,
                        }}
                      >
                        {s}
                      </div>
                      <div style={{ fontSize: 11, lineHeight: 1.45, color: textSecondary }}>
                        {client.scenarioImpacts[s]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Talking points */}
                <p style={{ ...sectionHeader, marginBottom: 6 }}>
                  Talking Points
                </p>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    listStyleType: "decimal",
                  }}
                >
                  {client.talkingPoints.map((tp, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 11,
                        lineHeight: 1.5,
                        color: textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      {tp}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
