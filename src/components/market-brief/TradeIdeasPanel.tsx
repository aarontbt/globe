import tradeData from "../../data/banker-trade-ideas.json";

// Inject pulse keyframe once at module load
const _style = document.createElement("style");
_style.textContent = `@keyframes cfPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`;
document.head.appendChild(_style);

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
  marginBottom: 12,
  fontFamily: CONDENSED,
};

const convictionColors: Record<string, string> = {
  high: "#34d399",
  medium: "#fbbf24",
  low: "rgba(255,255,255,0.35)",
};

const directionColors: Record<string, string> = {
  hedge: "#c4b5fd",
  long: "#34d399",
  short: "#f87171",
};

const urgencyColors: Record<string, string> = {
  high: "#f87171",
  medium: "#fbbf24",
};

export default function TradeIdeasPanel() {
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
      }}
    >
      {/* Trade Ideas — 2-column grid */}
      <p style={sectionHeader}>Trade Ideas</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 24,
        }}
      >
        {tradeData.tradeIdeas.map((idea, idx) => {
          const convColor = convictionColors[idea.conviction] || textSecondary;
          const dirColor = directionColors[idea.direction] || textSecondary;
          return (
            <div
              key={idea.id}
              style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                padding: 14,
                border: "1px solid rgba(255,255,255,0.05)",
                // Last item spans full width if odd count
                gridColumn:
                  tradeData.tradeIdeas.length % 2 !== 0 &&
                  idx === tradeData.tradeIdeas.length - 1
                    ? "span 2"
                    : undefined,
              }}
            >
              {/* Badges */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "2px 7px",
                    borderRadius: 3,
                    background: `${dirColor}12`,
                    color: dirColor,
                    fontFamily: CONDENSED,
                  }}
                >
                  {idea.direction}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "2px 7px",
                    borderRadius: 3,
                    background: `${convColor}12`,
                    color: convColor,
                    fontFamily: CONDENSED,
                  }}
                >
                  {idea.conviction}
                </span>
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: textPrimary,
                  lineHeight: 1.3,
                  marginBottom: 8,
                }}
              >
                {idea.title}
              </div>

              {/* Rationale */}
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: textSecondary,
                  marginBottom: 10,
                }}
              >
                {idea.rationale}
              </div>

              {/* Instruments */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {idea.instruments.map((inst) => (
                  <span
                    key={inst}
                    style={{
                      fontSize: 9,
                      padding: "2px 7px",
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: MONO,
                    }}
                  >
                    {inst}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.06)",
          margin: "0 0 20px",
        }}
      />

      {/* CF Triggers — 2-column grid */}
      <p style={sectionHeader}>Client Franchise Triggers</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {tradeData.cfTriggers.map((cf, idx) => {
          const urgColor = urgencyColors[cf.urgency] || textSecondary;
          return (
            <div
              key={cf.id}
              style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                padding: 14,
                borderLeft: `3px solid ${urgColor}`,
                gridColumn:
                  tradeData.cfTriggers.length % 2 !== 0 &&
                  idx === tradeData.cfTriggers.length - 1
                    ? "span 2"
                    : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                {/* Urgency dot */}
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: urgColor,
                    display: "inline-block",
                    flexShrink: 0,
                    animation:
                      cf.urgency === "high"
                        ? "cfPulse 2s ease-in-out infinite"
                        : "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: textPrimary,
                    flex: 1,
                  }}
                >
                  {cf.client}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "2px 7px",
                    borderRadius: 3,
                    background: "rgba(56,189,248,0.09)",
                    color: "#38bdf8",
                    fontFamily: CONDENSED,
                    whiteSpace: "nowrap",
                  }}
                >
                  {cf.trigger}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: textSecondary,
                }}
              >
                {cf.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
