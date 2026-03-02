import conflictData from "../../data/banker-conflict.json";

const ESCALATION_COLORS = ["#4ade80", "#a3e635", "#fbbf24", "#fb923c", "#ef4444"];
const ESCALATION_LABELS = ["Low", "Guarded", "Heightened", "High", "Severe"];

const MONO = "'IBM Plex Mono', 'Courier New', monospace";
const CONDENSED = "'Barlow Condensed', system-ui, sans-serif";

const sectionHeader: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.28)",
  margin: 0,
  marginBottom: 10,
  fontFamily: CONDENSED,
};

const scenarioColors: Record<string, string> = { base: "#34d399", stress: "#fbbf24", tail: "#f87171" };
const textPrimary = "rgba(255,255,255,0.9)";
const textSecondary = "rgba(255,255,255,0.5)";

export default function ConflictStatusPanel() {
  const { escalationLevel, deltaVsYesterday, todaysEvents, scenarios } = conflictData;
  const deltaSign = deltaVsYesterday > 0 ? "+" : "";
  const deltaColor =
    deltaVsYesterday > 0 ? "#f87171" : deltaVsYesterday < 0 ? "#34d399" : textSecondary;
  const levelColor = ESCALATION_COLORS[escalationLevel - 1];
  const levelLabel = ESCALATION_LABELS[escalationLevel - 1];

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
      {/* ── Escalation gauge – full width ── */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: levelColor,
                fontFamily: MONO,
                lineHeight: 1,
              }}
            >
              {escalationLevel}
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                /5
              </span>
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: levelColor,
                fontFamily: CONDENSED,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {levelLabel}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "3px 8px",
              borderRadius: 4,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: deltaColor,
              fontFamily: MONO,
            }}
          >
            {deltaSign}
            {deltaVsYesterday} vs yesterday
          </span>
        </div>

        {/* Five-segment bar */}
        <div style={{ display: "flex", gap: 3 }}>
          {ESCALATION_COLORS.map((color, i) => {
            const active = i < escalationLevel;
            const isCurrent = i === escalationLevel - 1;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  background: active ? color : "rgba(255,255,255,0.07)",
                  boxShadow: isCurrent ? `0 0 4px ${color}88` : "none",
                }}
              />
            );
          })}
        </div>

        {/* Level labels below bar */}
        <div
          style={{
            display: "flex",
            marginTop: 5,
          }}
        >
          {ESCALATION_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                fontSize: 8,
                color:
                  i === escalationLevel - 1
                    ? ESCALATION_COLORS[i]
                    : "rgba(255,255,255,0.2)",
                fontFamily: CONDENSED,
                fontWeight: i === escalationLevel - 1 ? 700 : 400,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 18px" }}
      />

      {/* ── Two-column: events left · scenarios right ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.9fr", gap: 20 }}>
        {/* Left — Today's Events */}
        <div>
          <p style={sectionHeader}>Today's Events</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {todaysEvents.map((evt) => {
              const isNeutral = evt.direction === "neutral";
              const isUp = evt.direction === "up";
              const arrowColor = isNeutral
                ? "rgba(255,255,255,0.22)"
                : isUp
                ? "#f87171"
                : "#34d399";
              const arrow = isNeutral ? "—" : isUp ? "▲" : "▼";
              return (
                <div
                  key={evt.id}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.03)",
                    borderLeft: `2px solid ${arrowColor}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        color: arrowColor,
                        fontSize: 8,
                        flexShrink: 0,
                        fontFamily: MONO,
                      }}
                    >
                      {arrow}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: CONDENSED,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {evt.delta}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: 11, color: textPrimary, lineHeight: 1.45 }}
                  >
                    {evt.summary}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Scenarios as 3-column grid */}
        <div>
          <p style={sectionHeader}>Scenario Analysis</p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
          >
            {scenarios.map((s) => {
              const color = scenarioColors[s.id] || "#38bdf8";
              return (
                <div
                  key={s.id}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderTop: `2px solid ${color}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {/* Label + probability */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color,
                        fontFamily: CONDENSED,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {s.label}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color,
                        fontFamily: MONO,
                        lineHeight: 1,
                      }}
                    >
                      {s.probability}%
                    </span>
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      fontSize: 10,
                      color: textSecondary,
                      lineHeight: 1.5,
                      flex: 1,
                    }}
                  >
                    {s.description}
                  </div>

                  {/* Oil / LNG impact chips */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 4,
                      paddingTop: 8,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {[
                      { label: "Oil", value: s.oilImpact },
                      { label: "LNG", value: s.lngImpact },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div
                          style={{
                            fontSize: 8,
                            color: "rgba(255,255,255,0.28)",
                            fontFamily: CONDENSED,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            marginBottom: 2,
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#fb923c",
                            fontFamily: MONO,
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
