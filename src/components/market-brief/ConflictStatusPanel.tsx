import { useState, type CSSProperties } from "react";
import { FONT_SANS } from "../../styles/fonts";
import { useStaticJson } from "../../hooks/useStaticJson";
import "./ConflictStatusPanel.css";
import SignalsHistoryPanel from "./SignalsHistoryPanel";

const TIERS = [
  { label: "Low", color: "#4ade80", meaning: "Normal conditions; no escalation." },
  { label: "Guarded", color: "#a3e635", meaning: "Diplomatic tension." },
  { label: "Heightened", color: "#fbbf24", meaning: "Military positioning and sanctions." },
  { label: "High", color: "#fb923c", meaning: "Active strikes or closures with material market impact." },
  { label: "Severe", color: "#ef4444", meaning: "Full theatre conflict and systemic disruption." },
];
const SCENARIO_COLORS: Record<string, string> = { base: "#34d399", stress: "#fbbf24", tail: "#f87171" };
const DIRECTIONS: Record<string, { label: string; symbol: string; color: string }> = {
  up: { label: "Worsening", symbol: "↑", color: "#f87171" },
  down: { label: "Improving", symbol: "↓", color: "#34d399" },
  neutral: { label: "Unchanged", symbol: "−", color: "#94a3b8" },
};

interface ConflictData {
  escalationLevel: number;
  deltaVsYesterday: number;
  todaysEvents: Array<{ id: string; summary: string; delta: string; direction: string }>;
  scenarios: Array<{ id: string; label: string; probability: number; summary?: string; description: string; oilImpact: string; lngImpact: string }>;
}

const EMPTY_CONFLICT: ConflictData = {
  escalationLevel: 0,
  deltaVsYesterday: 0,
  todaysEvents: [],
  scenarios: [],
};

function accent(color: string): CSSProperties {
  return { "--signal-accent": color } as CSSProperties;
}

export default function ConflictStatusPanel() {
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const { data, loading, error } = useStaticJson<ConflictData>("/data/banker-conflict.json", EMPTY_CONFLICT);
  const { escalationLevel, deltaVsYesterday, todaysEvents, scenarios } = data;
  const tier = Number.isInteger(escalationLevel) ? TIERS[escalationLevel - 1] : undefined;
  const unavailable = Boolean(error) || !tier;
  const deltaLabel = deltaVsYesterday === 0
    ? "Level unchanged"
    : `${deltaVsYesterday > 0 ? "↑" : "↓"} ${Math.abs(deltaVsYesterday)} ${Math.abs(deltaVsYesterday) === 1 ? "level" : "levels"} vs yesterday`;

  return (
    <section className="signals-panel" aria-label="Signals" style={{ fontFamily: FONT_SANS }}>
      {loading || unavailable ? (
        <p className="signals-empty" role="status">{loading ? "Loading signals…" : "Signals unavailable"}</p>
      ) : (
        <>
          <header className="signals-overview">
            <div>
              <h2 className="signals-label">Escalation</h2>
              <div className="signals-level" style={accent(tier.color)}>
                <strong>{escalationLevel}<small>/5</small></strong>
                <span>{tier.label}</span>
              </div>
              <span className="signals-delta">{deltaLabel}</span>
            </div>
            <div className="signals-scale">
              <div className="signals-segments" aria-label={`Escalation level ${escalationLevel} of 5: ${tier.label}`}>
                {TIERS.map((item, index) => (
                  <span key={item.label} style={{ background: index < escalationLevel ? item.color : "rgba(255,255,255,0.08)" }} />
                ))}
              </div>
              <details className="signals-tier-guide">
                <summary>Tier guide</summary>
                <p>Analyst-assigned severity</p>
                <ol>
                  {TIERS.map((item, index) => (
                    <li key={item.label} aria-current={index + 1 === escalationLevel ? "step" : undefined}>
                      <strong style={{ color: item.color }}>{item.label}</strong>
                      <span>{item.meaning}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          </header>

          <div className="signals-content">
            <section aria-labelledby="signals-developments">
              <h2 id="signals-developments" className="signals-label">Latest developments</h2>
              <div className="signals-events">
                {todaysEvents.length === 0 && <p className="signals-empty">No developments available.</p>}
                {todaysEvents.map((event) => {
                  const direction = DIRECTIONS[event.direction] ?? DIRECTIONS.neutral;
                  return (
                    <details key={event.id} className="signals-event" style={accent(direction.color)}>
                      <summary>
                        <span className="signals-direction" role="img" aria-label={direction.label} title={direction.label}>{direction.symbol}</span>
                        <span className="signals-event-title">{event.summary}</span>
                        <span className="signals-chevron" aria-hidden="true">⌄</span>
                      </summary>
                      <div className="signals-event-detail">
                        <span className="signals-direction-label">{direction.label}</span>
                        <p>{event.delta}</p>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="signals-outlook">
              <div className="signals-section-heading">
                <h2 id="signals-outlook" className="signals-label">Scenario outlook</h2>
                <span>Analyst estimates</span>
              </div>
              <div className="signals-scenarios">
                {scenarios.map((scenario) => (
                  <details key={scenario.id} open={scenariosOpen} className="signals-scenario" style={accent(SCENARIO_COLORS[scenario.id] ?? "#38bdf8")}>
                    <summary onClick={(event) => {
                      event.preventDefault();
                      setScenariosOpen((open) => !open);
                    }}>
                      <span className="signals-scenario-name">{scenario.label}<span className="signals-chevron" aria-hidden="true">⌄</span></span>
                      <strong className="signals-probability">{scenario.probability}<small>%</small></strong>
                      <span className="signals-probability-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, scenario.probability))}%` }} /></span>
                      <span className="signals-scenario-summary">{scenario.summary || scenario.description.split(/(?<=[.!?])\s/)[0]}</span>
                    </summary>
                    <div className="signals-scenario-detail">
                      <p>{scenario.description}</p>
                      <dl>
                        <div><dt>Oil impact</dt><dd>{scenario.oilImpact}</dd></div>
                        <div><dt>LNG impact</dt><dd>{scenario.lngImpact}</dd></div>
                      </dl>
                    </div>
                  </details>
                ))}
              </div>
              {scenarios.length === 0 && <p className="signals-empty">No scenarios available.</p>}
            </section>
          </div>
          <SignalsHistoryPanel />
        </>
      )}
    </section>
  );
}
