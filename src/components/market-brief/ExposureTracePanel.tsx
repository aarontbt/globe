import { useMemo, useState } from "react";
import type {
  DerivedCommercialMetric,
  EvidenceReference,
  ExposureTrace,
  ExposureTraceData,
  PublicEntity,
  ResidualStatus,
  TraceMetric,
  TraceStage,
} from "../../types";
import type { EnergyAlternative, FlowPressureAssessment } from "../../types/energyLng";
import { FONT_SANS } from "../../styles/fonts";

const STAGE_COLORS: Record<TraceStage, string> = {
  signal: "#f87171",
  supply: "#fb923c",
  transport: "#fbbf24",
  demand: "#38bdf8",
  counterparty: "#a78bfa",
};

const RESIDUAL_COLORS: Record<ResidualStatus, string> = {
  "positive-residual": "#34d399",
  "crosses-zero": "#fbbf24",
  "negative-residual": "#f87171",
  "insufficient-verified-data": "rgba(255,255,255,0.38)",
};

interface TracePanelProps {
  data: ExposureTraceData;
  activeTraceId: string;
  onTraceChange: (traceId: string) => void;
}

const sectionCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8,
  padding: "10px 12px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "rgba(255,255,255,0.5)",
  fontSize: 12,
  padding: "4px 0",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: "rgba(255,255,255,0.48)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        marginBottom: 5,
      }}
    >
      {children}
    </div>
  );
}

function entityMap(data: ExposureTraceData) {
  return new Map(data.entities.map((entity) => [entity.id, entity]));
}

function getActiveTrace(data: ExposureTraceData, activeTraceId: string) {
  return data.traces.find((trace) => trace.id === activeTraceId) ?? data.traces[0];
}

function metricValue(metric: TraceMetric) {
  if (metric.low !== undefined && metric.high !== undefined) {
    return `${metric.low}-${metric.high}${metric.unit ? ` ${metric.unit}` : ""}`;
  }
  if (metric.value !== undefined) {
    return `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
  }
  return "Insufficient verified data";
}

function statusLabel(metric: TraceMetric) {
  if (metric.status === "carried") return `historical observation · ${metric.sourceDate}`;
  if (metric.status === "unavailable") return metric.missingReason ?? "Insufficient verified data";
  return `verified ${metric.sourceDate}`;
}

function derivedValue(metric: DerivedCommercialMetric) {
  if (metric.status === "unavailable") return "Insufficient verified data";
  if (metric.displayLow !== undefined && metric.displayHigh !== undefined) {
    return `${metric.displayLow}-${metric.displayHigh} ${metric.unit}`;
  }
  return `${metric.displayValue} ${metric.unit}`;
}

function residualLabel(status: ResidualStatus) {
  return status.replace(/-/g, " ");
}

function pressureColor(score: number) {
  if (score >= 70) return "#f87171";
  if (score >= 45) return "#fbbf24";
  return "#34d399";
}

function pressureStatusLabel(status: FlowPressureAssessment["status"]) {
  if (status === "assessed") return "assessed";
  if (status === "provisional") return "provisional";
  return "insufficient verified data";
}

function alternativeKindLabel(kind: EnergyAlternative["kind"]) {
  if (kind === "source") return "supply source";
  if (kind === "market") return "destination market";
  return "route / terminal";
}

function alternativeFeasibilityLabel(feasibility: EnergyAlternative["feasibility"]) {
  if (feasibility === "potential") return "potential — not verified";
  if (feasibility === "physically-feasible") return "Physically feasible";
  if (feasibility === "commercially-executable") return "Commercially executable";
  return "Insufficient verified data";
}

function FlowPressureCard({
  assessment,
  alternatives,
  evidence,
}: {
  assessment?: FlowPressureAssessment;
  alternatives?: EnergyAlternative[];
  evidence: EvidenceReference[];
}) {
  if (!assessment) return null;
  const color = pressureColor(assessment.score);
  return (
    <div style={{ ...sectionCard, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <SectionLabel>Flow pressure</SectionLabel>
          <div style={{ fontSize: 28, fontWeight: 850, color, lineHeight: 1 }}>{assessment.score}<span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}> / 100</span></div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.70)", marginTop: 6 }}>
            {pressureStatusLabel(assessment.status)} · {assessment.confidence} confidence
          </div>
        </div>
        <div style={{ maxWidth: 360, fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.45, textAlign: "right" }}>
          Higher score = more pressure. Missing data lowers confidence.
          <div style={{ marginTop: 5, color: "rgba(255,255,255,0.62)" }}>
            {assessment.evidenceIds.filter((id) => evidence.some((item) => item.id === id)).length} evidence
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
        {assessment.components.map((component) => {
          const componentColor = pressureColor(component.score);
          return (
            <div key={component.id} style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.82)" }}>{component.label}</span>
                <strong style={{ color: componentColor }}>{component.score}</strong>
              </div>
              <div style={{ height: 3, marginTop: 6, borderRadius: 2, background: "rgba(255,255,255,0.07)" }}>
                <div style={{ width: `${component.score}%`, height: "100%", borderRadius: 2, background: componentColor }} />
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.68)", marginTop: 5, lineHeight: 1.35 }}>
                {component.status.replace(/-/g, " ")} · {Math.round(component.weight * 100)}% · {component.evidenceIds.length} evidence
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)", fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
        <strong style={{ color: "rgba(255,255,255,0.88)" }}>Alternative:</strong>{" "}
        {alternatives && alternatives.length > 0
          ? alternatives.map((alternative) => `${alternative.rank ?? "—"}. ${alternative.label} · ${alternativeKindLabel(alternative.kind)} · ${alternativeFeasibilityLabel(alternative.feasibility)}`).join("; ")
          : "No ranked alternative source, market, route or terminal is currently verified."}
      </div>
    </div>
  );
}

function TraceSelector({ data, activeTraceId, onTraceChange }: TracePanelProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
      {data.traces.map((trace, index) => {
        const active = trace.id === activeTraceId;
        return (
          <button
            key={trace.id}
            onClick={() => onTraceChange(trace.id)}
            style={{
              textAlign: "left",
              background: active ? "rgba(56,189,248,0.10)" : "rgba(255,255,255,0.025)",
              border: active ? "1px solid rgba(56,189,248,0.45)" : "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "rgba(255,255,255,0.9)",
              cursor: "pointer",
              fontFamily: FONT_SANS,
            }}
          >
            <div
              style={{
                color: active ? "#38bdf8" : "rgba(255,255,255,0.28)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Trace {String(index + 1).padStart(2, "0")} · {trace.commodity === "lng" ? "LNG" : "Crude oil"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{trace.title}</div>
          </button>
        );
      })}
    </div>
  );
}

function TraceHeader({ data, trace }: { data: ExposureTraceData; trace: ExposureTrace }) {
  return (
    <div style={{ maxWidth: 960 }}>
      <div
        style={{
          fontSize: 12,
          color: "#38bdf8",
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        Iran / Hormuz {trace.commodity === "lng" ? "LNG" : "crude oil"} exposure trace
      </div>
      <div style={{ fontSize: 22, color: "rgba(255,255,255,0.95)", fontWeight: 750 }}>{trace.headline}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", marginTop: 5, lineHeight: 1.45 }}>
        {data.headline}
      </div>
    </div>
  );
}

export default function ExposureTracePanel({ data, activeTraceId, onTraceChange }: TracePanelProps) {
  const trace = getActiveTrace(data, activeTraceId);
  const entities = useMemo(() => entityMap(data), [data]);
  const [selectedHopId, setSelectedHopId] = useState<string | null>(null);

  if (!trace) {
    return <div style={{ padding: 24, color: "rgba(255,255,255,0.5)" }}>Exposure trace data is loading.</div>;
  }

  const selectedHop = trace.hops.find((hop) => hop.id === selectedHopId) ?? trace.hops[0];
  const selectedEvidence = data.evidence.filter((item) => selectedHop.evidenceIds.includes(item.id));
  const allMetrics = trace.hops.flatMap((hop) => hop.metrics);

  return (
    <div style={{ fontFamily: FONT_SANS, color: "rgba(255,255,255,0.9)", display: "flex", flexDirection: "column", gap: 12 }}>
      <TraceHeader data={data} trace={trace} />
      <TraceSelector data={data} activeTraceId={trace.id} onTraceChange={onTraceChange} />
      <FlowPressureCard assessment={trace.flowPressure} alternatives={trace.alternatives} evidence={data.evidence} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 7, alignItems: "stretch" }}>
        {trace.hops.map((hop, index) => {
          const color = STAGE_COLORS[hop.stage];
          const selected = selectedHop.id === hop.id;
          const namedEntities = hop.entityIds.map((id) => entities.get(id)?.shortName).filter(Boolean).join(" · ");
          const evidence = data.evidence.find((item) => hop.evidenceIds.includes(item.id));
          return (
            <button
              key={hop.id}
              onClick={() => setSelectedHopId(hop.id)}
              style={{
                position: "relative",
                minHeight: 184,
                alignSelf: "stretch",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "flex-start",
                boxSizing: "border-box",
                textAlign: "left",
                padding: "12px 12px 10px",
                borderRadius: 9,
                background: selected ? `${color}12` : "rgba(255,255,255,0.025)",
                border: selected ? `1px solid ${color}66` : "1px solid rgba(255,255,255,0.07)",
                cursor: "pointer",
                color: "rgba(255,255,255,0.9)",
                fontFamily: FONT_SANS,
              }}
            >
              {index < trace.hops.length - 1 && (
                <span style={{ position: "absolute", right: -16, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.42)", fontSize: 25, fontWeight: 900, lineHeight: 1, zIndex: 2, pointerEvents: "none", WebkitTextStroke: "0.6px currentColor", filter: "drop-shadow(0 0 3px rgba(255,255,255,0.18))" }}>
                  →
                </span>
              )}
              <div style={{ color, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                {hop.stage}
              </div>
              <div style={{ fontSize: 15, fontWeight: 750, lineHeight: 1.2, marginBottom: 5 }}>{hop.label}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginBottom: 9 }}>{namedEntities}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.54)", lineHeight: 1.45 }}>{hop.summary}</div>
              <div style={{ marginTop: 10 }}>
                {hop.metrics.map((metric) => (
                  <div key={`${hop.id}-${metric.inputId}`} style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", textTransform: "uppercase" }}>{metric.label}</div>
                    {evidence && metric.status !== "unavailable" ? (
                      <a href={evidence.url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 14, fontWeight: 750, color, textDecoration: "none" }}>
                        {metricValue(metric)} ↗
                      </a>
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 750, color: metric.status === "unavailable" ? "rgba(255,255,255,0.32)" : color }}>
                        {metricValue(metric)}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{statusLabel(metric)}</div>
                    {(metric.machineEvidenceIds?.length ?? 0) > 0 && (
                      <div style={{ fontSize: 11, color: "#67e8f9", marginTop: 2 }}>machine snapshot lineage validated</div>
                    )}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.15fr 1.8fr", gap: 8 }}>
        <div style={sectionCard}>
          <SectionLabel>Verified data coverage</SectionLabel>
          <div style={rowStyle}><span>Current verified</span><strong>{allMetrics.filter((metric) => metric.status === "confirmed").length}</strong></div>
          <div style={rowStyle}><span>Historical carried</span><strong>{allMetrics.filter((metric) => metric.status === "carried").length}</strong></div>
          <div style={rowStyle}><span>Unavailable</span><strong>{allMetrics.filter((metric) => metric.status === "unavailable").length}</strong></div>
        </div>

        <div style={sectionCard}>
          <SectionLabel>Selected-hop evidence</SectionLabel>
          <div style={rowStyle}><span>Evidence links</span><strong>{selectedEvidence.length}</strong></div>
          {selectedEvidence.map((evidence) => (
            <a key={evidence.id} href={evidence.url} target="_blank" rel="noreferrer" style={{ display: "block", color: "#7dd3fc", fontSize: 12, lineHeight: 1.35, textDecoration: "none", marginTop: 6 }}>
              {evidence.publisher}: {evidence.title} ↗
            </a>
          ))}
        </div>

        <div style={sectionCard}>
          <SectionLabel>Portfolio action</SectionLabel>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.68)", lineHeight: 1.5 }}>{trace.portfolioAction}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
            {trace.watchItems.map((item) => (
              <span key={item} style={{ padding: "3px 6px", borderRadius: 4, background: "rgba(56,189,248,0.06)", color: "rgba(125,211,252,0.7)", fontSize: 12 }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TraceCounterpartiesPanel({ data, activeTraceId, onTraceChange }: TracePanelProps) {
  const trace = getActiveTrace(data, activeTraceId);
  const entities = useMemo(() => entityMap(data), [data]);
  if (!trace) return null;

  return (
    <div style={{ fontFamily: FONT_SANS, color: "rgba(255,255,255,0.9)" }}>
      <TraceSelector data={data} activeTraceId={trace.id} onTraceChange={onTraceChange} />
      {trace.counterparties.length === 0 && (
        <div style={{ ...sectionCard, padding: 18, marginTop: 14 }}>
          <SectionLabel>Counterparty status</SectionLabel>
          <div style={{ fontSize: 15, fontWeight: 750 }}>No named public relationship verified</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.48)", marginTop: 7, lineHeight: 1.5 }}>
            Current sources support country and market exposure only. No company-level relationship is displayed.
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
        {trace.counterparties.map((counterparty) => {
          const entity = entities.get(counterparty.entityId);
          const evidence = data.evidence.find((item) => counterparty.evidenceIds.includes(item.id));
          return (
            <div key={counterparty.entityId} style={{ ...sectionCard, padding: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 750 }}>{entity?.name ?? counterparty.entityId}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", marginTop: 3 }}>{entity?.country} · {counterparty.role}</div>
              <div style={{ margin: "12px 0", fontSize: 12, color: "rgba(255,255,255,0.58)", lineHeight: 1.5 }}>{counterparty.summary}</div>
              <div style={rowStyle}><span>Relationship</span><strong>{counterparty.relationship}</strong></div>
              <div style={rowStyle}>
                <span>Verified observation</span>
                {evidence ? (
                  <a href={evidence.url} target="_blank" rel="noreferrer" style={{ color: "#7dd3fc", textDecoration: "none" }}>{counterparty.publicObservation} ↗</a>
                ) : (
                  <strong>{counterparty.publicObservation}</strong>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CommercialEvaluationPanel({ data, activeTraceId, onTraceChange }: TracePanelProps) {
  const trace = getActiveTrace(data, activeTraceId);
  if (!trace) return null;
  const evaluation = trace.commercialEvaluation;
  const inputs = evaluation.observedInputIds
    .map((id) => data.commercialInputs.find((input) => input.inputId === id))
    .filter((input): input is NonNullable<typeof input> => Boolean(input));
  const evidenceById = new Map(data.evidence.map((item) => [item.id, item]));

  return (
    <div style={{ fontFamily: FONT_SANS, color: "rgba(255,255,255,0.9)" }}>
      <TraceSelector data={data} activeTraceId={trace.id} onTraceChange={onTraceChange} />
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.9fr", gap: 12, marginTop: 14 }}>
        <div style={{ ...sectionCard, padding: 16 }}>
          <SectionLabel>Mechanical result</SectionLabel>
          <div style={{ fontSize: 20, fontWeight: 800, color: RESIDUAL_COLORS[evaluation.residualStatus], textTransform: "capitalize" }}>
            {residualLabel(evaluation.residualStatus)}
          </div>
          <div style={rowStyle}><span>Commodity</span><strong>{trace.commodity === "lng" ? "LNG" : "Crude oil"}</strong></div>
          <div style={rowStyle}><span>Mode</span><strong>{evaluation.mode.replace(/-/g, " ")}</strong></div>
          <div style={rowStyle}>
            <span>Verified completeness</span>
            <strong>
              {evaluation.requiredInputIds.filter((id) => data.commercialInputs.find((input) => input.inputId === id)?.status === "confirmed").length}/{evaluation.requiredInputIds.length}
            </strong>
          </div>
          {evaluation.missingInputIds.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.45)" }}>
              Missing: {evaluation.missingInputIds.join(", ")}
            </div>
          )}
        </div>

        <div style={{ ...sectionCard, padding: 16 }}>
          <SectionLabel>Calculation lineage</SectionLabel>
          {evaluation.derivedMetrics.map((metric) => (
            <div key={metric.metricId} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{metric.label}</span>
                <strong style={{ fontSize: 12, color: metric.status === "derived" ? "#7dd3fc" : "rgba(255,255,255,0.34)" }}>{derivedValue(metric)}</strong>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
                {metric.formulaId} · {metric.inputIds.join(" + ")} · {metric.calculatedAt}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginTop: 12 }}>
        <div style={{ ...sectionCard, padding: 16 }}>
          <SectionLabel>Observed inputs</SectionLabel>
          {inputs.map((input) => {
            const evidence = input.evidenceIds.map((id) => evidenceById.get(id)).find(Boolean);
            return (
              <div key={input.inputId} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 12 }}>{input.label}</span>
                {evidence && input.status !== "unavailable" ? (
                  <a href={evidence.url} target="_blank" rel="noreferrer" style={{ color: "#7dd3fc", fontSize: 12, textDecoration: "none" }}>{metricValue(input)} ↗</a>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 12 }}>{metricValue(input)}</span>
                )}
                <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 12 }}>{statusLabel(input)}</span>
              </div>
            );
          })}
        </div>

        <div style={{ ...sectionCard, padding: 16 }}>
          <SectionLabel>Risk controls</SectionLabel>
          {evaluation.riskControls.map((control) => (
            <div key={control.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{control.label}</span>
                <span style={{ fontSize: 12, color: control.status === "verified" ? "#34d399" : "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{control.status.replace(/-/g, " ")}</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.4, marginTop: 4 }}>{control.summary}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TraceActionsPanel({ data, activeTraceId, onTraceChange }: TracePanelProps) {
  const trace = getActiveTrace(data, activeTraceId);
  const [copied, setCopied] = useState(false);
  if (!trace) return null;

  const copyBrief = async () => {
    const chain = trace.hops.map((hop) => `${hop.stage.toUpperCase()}: ${hop.label} - ${hop.summary}`).join("\n");
    const text = [
      `SIGNAL TO EXPOSURE: ${trace.title}`,
      `As of: ${data.asOf}`,
      "",
      chain,
      "",
      `COMMERCIAL DATA STATUS: ${trace.commercialEvaluation.dataStatus}`,
      `RESIDUAL STATUS: ${residualLabel(trace.commercialEvaluation.residualStatus)}`,
      `MISSING VERIFIED INPUTS: ${trace.commercialEvaluation.missingInputIds.join(", ") || "none"}`,
      "",
      `PORTFOLIO ACTION: ${trace.portfolioAction}`,
      `WATCH: ${trace.watchItems.join("; ")}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ fontFamily: FONT_SANS, color: "rgba(255,255,255,0.9)" }}>
      <TraceSelector data={data} activeTraceId={trace.id} onTraceChange={onTraceChange} />
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={{ ...sectionCard, borderLeft: "3px solid #38bdf8", padding: 18 }}>
          <SectionLabel>Decision brief</SectionLabel>
          <div style={{ fontSize: 21, fontWeight: 750, margin: "8px 0 10px" }}>{trace.title}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.65 }}>{trace.portfolioAction}</div>
          <button onClick={copyBrief} style={{ marginTop: 18, padding: "8px 14px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.28)", background: "rgba(56,189,248,0.08)", color: copied ? "#34d399" : "#7dd3fc", fontFamily: FONT_SANS, fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
            {copied ? "Copied" : "Copy decision brief"}
          </button>
        </div>
        <div style={{ ...sectionCard, padding: 18 }}>
          <SectionLabel>Watch next</SectionLabel>
          {trace.watchItems.map((item, index) => (
            <div key={item} style={{ display: "flex", gap: 9, marginTop: 10 }}>
              <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 800 }}>{String(index + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.58)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TraceEvidencePanel({ data, activeTraceId, onTraceChange }: TracePanelProps) {
  const trace = getActiveTrace(data, activeTraceId);
  if (!trace) return null;
  const traceEvidenceIds = new Set([
    ...trace.hops.flatMap((hop) => hop.evidenceIds),
    ...trace.counterparties.flatMap((counterparty) => counterparty.evidenceIds),
    ...trace.commercialEvaluation.observedInputIds.flatMap((id) => data.commercialInputs.find((input) => input.inputId === id)?.evidenceIds ?? []),
  ]);
  const evidence = data.evidence.filter((item) => traceEvidenceIds.has(item.id));
  const traceInputIds = new Set([
    ...trace.hops.flatMap((hop) => hop.metrics.map((metric) => metric.inputId)),
    ...trace.commercialEvaluation.observedInputIds,
  ]);
  const machineEvidence = (data.machineEvidence ?? []).filter((item) =>
    item.targetInputIds.some((id) => traceInputIds.has(id))
      || item.targetCommercialInputIds.some((id) => traceInputIds.has(id)),
  );

  return (
    <div style={{ fontFamily: FONT_SANS, color: "rgba(255,255,255,0.9)" }}>
      <TraceSelector data={data} activeTraceId={trace.id} onTraceChange={onTraceChange} />
      <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={{ ...sectionCard, padding: 16 }}>
          <SectionLabel>Verified evidence</SectionLabel>
          {evidence.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer" style={{ display: "grid", gridTemplateColumns: "110px 1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.72)", textDecoration: "none" }}>
              <span style={{ color: "#7dd3fc", fontSize: 12, fontWeight: 750 }}>{item.publisher}</span>
              <span style={{ fontSize: 12 }}>{item.title}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{item.publishedAt} ↗</span>
            </a>
          ))}
          {machineEvidence.length > 0 && (
            <>
              <SectionLabel>Machine snapshot evidence</SectionLabel>
              {machineEvidence.map((item) => (
                <a key={item.id} href={item.url} target="_blank" rel="noreferrer" style={{ display: "grid", gridTemplateColumns: "110px 1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(103,232,249,0.12)", color: "rgba(255,255,255,0.72)", textDecoration: "none" }}>
                  <span style={{ color: "#67e8f9", fontSize: 12, fontWeight: 750 }}>{item.provider}</span>
                  <span style={{ fontSize: 12 }}>Validated snapshot · {item.recordKeys.length} record{item.recordKeys.length === 1 ? "" : "s"}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{item.retrievedAt.slice(0, 10)} ↗</span>
                </a>
              ))}
            </>
          )}
        </div>
        <div style={{ ...sectionCard, padding: 16 }}>
          <SectionLabel>Verified-data rule</SectionLabel>
          <div style={{ fontSize: 12, fontWeight: 700 }}>No analytical inputs published</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.46)", lineHeight: 1.5, marginTop: 6 }}>
            Missing, carried, or stale observations remain outside commercial calculations.
          </div>
        </div>
      </div>
    </div>
  );
}
