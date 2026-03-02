import { useState, useMemo, useCallback, useEffect } from "react";
import clientsData from "../../data/banker-clients.json";

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

type ScenarioKey = "base" | "stress" | "tail";

const SCENARIO_OPTIONS: { key: ScenarioKey; label: string; color: string }[] = [
  { key: "base", label: "Base", color: "#34d399" },
  { key: "stress", label: "Stress", color: "#fbbf24" },
  { key: "tail", label: "Tail", color: "#f87171" },
];

export default function ClientBriefPanel() {
  const { clients } = clientsData;
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? "");
  const [scenario, setScenario] = useState<ScenarioKey>("base");
  const [copied, setCopied] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? clients[0],
    [clients, selectedClientId]
  );

  const scenarioOption = SCENARIO_OPTIONS.find((s) => s.key === scenario);
  const scenarioImpact = client?.scenarioImpacts[scenario];

  const briefText = useMemo(() => {
    if (!client || !scenarioImpact) return "";
    const scenarioLabel = scenarioOption?.label ?? scenario;
    const lines = [
      `CLIENT BRIEF: ${client.name}`,
      `Sector: ${client.sector} | Country: ${client.country}`,
      `Scenario: ${scenarioLabel}`,
      ``,
      `SCENARIO ASSESSMENT`,
      scenarioImpact,
      ``,
      `TALKING POINTS`,
      ...client.talkingPoints.map((tp: string, i: number) => `${i + 1}. ${tp}`),
      ``,
      `NEXT STEPS`,
      `- Review exposure limits and covenant headroom`,
      `- Schedule client engagement call within 48 hours`,
      `- Circulate updated risk assessment to coverage team`,
    ];
    return lines.join("\n");
  }, [client, scenarioImpact, scenarioOption]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(briefText);
    setCopied(true);
  }, [briefText]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!client || !scenarioImpact) return null;

  const scenarioColor = scenarioOption?.color ?? "#22d3ee";
  const exposureTotal = Object.values(client.exposure).reduce(
    (a, b) => a + (b as number),
    0
  );
  const exposureMax = Object.keys(client.exposure).length * 10;

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "rgba(10,14,23,0.88)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        color: textPrimary,
        display: "flex",
        gap: 0,
        overflow: "hidden",
      }}
    >
      {/* ── Left sidebar: controls ── */}
      <div
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Client Selector */}
        <div>
          <p style={sectionHeader}>Client</p>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              color: textPrimary,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {clients.map((c) => (
              <option
                key={c.id}
                value={c.id}
                style={{ background: "#0a0e17", color: textPrimary }}
              >
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scenario Selector */}
        <div>
          <p style={sectionHeader}>Scenario</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {SCENARIO_OPTIONS.map((opt) => {
              const active = scenario === opt.key;
              return (
                <label
                  key={opt.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${active ? opt.color + "44" : "rgba(255,255,255,0.07)"}`,
                    background: active ? opt.color + "10" : "transparent",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: active ? 700 : 400,
                    color: active ? opt.color : textSecondary,
                    fontFamily: CONDENSED,
                    letterSpacing: "0.06em",
                  }}
                >
                  <input
                    type="radio"
                    name="scenario"
                    value={opt.key}
                    checked={active}
                    onChange={() => setScenario(opt.key)}
                    style={{ display: "none" }}
                  />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: active ? opt.color : "rgba(255,255,255,0.15)",
                      flexShrink: 0,
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* Exposure Heatmap (compact) */}
        <div>
          <p style={sectionHeader}>
            Exposure{" "}
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: 0,
              }}
            >
              {exposureTotal}/{exposureMax}
            </span>
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 5,
            }}
          >
            {Object.entries(client.exposure).map(([key, val]) => {
              const score = val as number;
              const intensity = score / 10;
              const color =
                intensity >= 0.7
                  ? "#f87171"
                  : intensity >= 0.4
                  ? "#fbbf24"
                  : "#34d399";
              return (
                <div
                  key={key}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 5,
                    background: color + "0f",
                    border: `1px solid ${color}20`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 7,
                      color: "rgba(255,255,255,0.3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontFamily: CONDENSED,
                      marginBottom: 2,
                    }}
                  >
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color,
                      fontFamily: MONO,
                      lineHeight: 1,
                    }}
                  >
                    {score}
                    <span
                      style={{
                        fontSize: 8,
                        color: "rgba(255,255,255,0.2)",
                        fontWeight: 400,
                      }}
                    >
                      /10
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          style={{
            width: "100%",
            padding: "9px 0",
            borderRadius: 6,
            border: `1px solid ${copied ? "rgba(52,211,153,0.25)" : "rgba(56,189,248,0.18)"}`,
            background: copied
              ? "rgba(52,211,153,0.10)"
              : "rgba(56,189,248,0.06)",
            color: copied ? "#34d399" : "#38bdf8",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: CONDENSED,
            cursor: "pointer",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginTop: "auto",
          }}
        >
          {copied ? "Copied ✓" : "Copy Brief"}
        </button>
      </div>

      {/* ── Right content: brief ── */}
      <div
        style={{
          flex: 1,
          padding: 20,
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.10) transparent",
        }}
      >
        {/* Client header */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={{ fontSize: 18, fontWeight: 700, color: textPrimary, lineHeight: 1.2 }}
          >
            {client.name}
          </div>
          <div style={{ fontSize: 11, color: textSecondary, marginTop: 4 }}>
            {client.sector} &nbsp;·&nbsp; {client.country}
          </div>
        </div>

        <div
          style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 18 }}
        />

        {/* Scenario Assessment */}
        <div style={{ marginBottom: 18 }}>
          <p style={sectionHeader}>
            Scenario Assessment —{" "}
            <span
              style={{
                color: scenarioColor,
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              {scenarioOption?.label}
            </span>
          </p>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              background: scenarioColor + "08",
              border: `1px solid ${scenarioColor}1e`,
              fontSize: 12,
              color: textSecondary,
              lineHeight: 1.65,
              borderLeft: `3px solid ${scenarioColor}`,
            }}
          >
            {scenarioImpact}
          </div>
        </div>

        {/* Talking Points */}
        <div style={{ marginBottom: 18 }}>
          <p style={sectionHeader}>Talking Points</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {client.talkingPoints.map((tp: string, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.25)",
                    fontFamily: MONO,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 12, color: textSecondary, lineHeight: 1.55 }}>
                  {tp}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div>
          <p style={sectionHeader}>Next Steps</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              "Review exposure limits and covenant headroom",
              "Schedule client engagement call within 48 hours",
              "Circulate updated risk assessment to coverage team",
            ].map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "rgba(56,189,248,0.5)",
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />
                <span style={{ fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
