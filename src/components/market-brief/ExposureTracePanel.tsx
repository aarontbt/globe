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
import "./TraceSupportingPanels.css";

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

function formatValuePart(value: number | string, unit?: string | null) {
  if (unit === "USD" && typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return String(value);
}

function displayValue(value: number | string | undefined, unit?: string | null) {
  if (value === undefined) return "unavailable";
  return `${formatValuePart(value, unit)}${unit ? ` ${unit}` : ""}`;
}

function signalLabel(observation: NonNullable<NonNullable<ExposureTrace["physicalFlow"]>["observations"]>[number]) {
  switch (observation.sourceId) {
    case "src-gem-ras-laffan-capacity":
    case "src-qatarenergy-ras-laffan-capacity":
      return "Ras Laffan capacity";
    case "src-gem-ras-laffan-status":
    case "src-reviewed-ras-laffan-status":
      return "Ras Laffan status";
    default:
      return observation.label;
  }
}

function latestSignals(observations: NonNullable<NonNullable<ExposureTrace["physicalFlow"]>["observations"]>) {
  const latest = new Map<string, (typeof observations)[number]>();
  for (const observation of observations) {
    const key = `${observation.sourceId ?? observation.label}:${observation.unit ?? ""}`;
    const current = latest.get(key);
    const observationDate = observation.periodEnd ?? observation.periodStart ?? "";
    const currentDate = current?.periodEnd ?? current?.periodStart ?? "";
    if (!current || observationDate >= currentDate) latest.set(key, observation);
  }
  return [...latest.values()];
}

function metricValue(metric: TraceMetric) {
  if (metric.low !== undefined && metric.high !== undefined) {
    return `${formatValuePart(metric.low, metric.unit)}-${formatValuePart(metric.high, metric.unit)}${metric.unit ? ` ${metric.unit}` : ""}`;
  }
  if (metric.value !== undefined) {
    return displayValue(metric.value, metric.unit);
  }
  return "Insufficient verified data";
}

function statusLabel(metric: TraceMetric) {
  if (metric.status === "carried") return metric.sourceDate ? `historical · ${metric.sourceDate}` : "historical";
  if (metric.status === "unavailable") return "not currently verified";
  return "verified";
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

function PhysicalFlowTimeline({ trace }: { trace: ExposureTrace }) {
  const observations = latestSignals(trace.physicalFlow?.observations ?? []);
  const direct = observations.filter((item) => (
    (item.coverageStatus === "direct-observation" || item.coverageStatus === "partial-coverage")
      && item.status !== "unavailable"
      && item.value !== undefined
      && Boolean(item.source.trim())
      && Boolean(item.periodEnd ?? item.periodStart)
      && (item.evidenceIds.length > 0 || (item.machineEvidenceIds?.length ?? 0) > 0)
      && item.sourceId !== "src-unlocode-ras-laffan"
      && !(item.observationKind === "asset-status" && item.value === item.label)
  ));
  const groups = [
    { label: "Key physical signals", items: direct, color: "#34d399" },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div style={{ ...sectionCard, padding: 14 }}>
      <SectionLabel>Key signals</SectionLabel>

      {groups.map((group) => (
        <div key={group.label} style={{ marginTop: 13 }}>
          <div style={{ color: group.color, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{group.label}</div>
          {group.items.map((observation) => (
          <div key={observation.id} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.86)", fontWeight: 700 }}>{signalLabel(observation)}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.42)", marginTop: 3 }}>
                  {observation.source} · {observation.periodStart && observation.periodEnd && observation.periodStart !== observation.periodEnd
                    ? `${observation.periodStart}–${observation.periodEnd}`
                    : observation.periodEnd ?? observation.periodStart}
                  {observation.coverageStatus === "partial-coverage" ? " · partial coverage" : " · direct observation"}
                  {observation.status === "carried" ? " · historical" : ""}
                </div>
                {observation.coverageStatus === "partial-coverage" && observation.coverageNote && (
                  <div style={{ fontSize: 10, lineHeight: 1.35, color: "rgba(255,255,255,0.36)", marginTop: 3 }}>
                    {observation.coverageNote}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: group.color, fontWeight: 750 }}>{displayValue(observation.value, observation.unit)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
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
  if (!assessment || assessment.status === "insufficient-verified-data") return null;
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
      <PhysicalFlowTimeline trace={trace} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 7, alignItems: "stretch" }}>
        {trace.hops.map((hop, index) => {
          const color = STAGE_COLORS[hop.stage];
          const selected = selectedHop.id === hop.id;
          const namedEntities = hop.entityIds.map((id) => entities.get(id)?.shortName).filter(Boolean).join(" · ");
          const evidence = data.evidence.find((item) => hop.evidenceIds.includes(item.id));
          const visibleMetrics = hop.metrics.filter((metric) => metric.status !== "unavailable");
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
              {visibleMetrics.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {visibleMetrics.map((metric) => (
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
                    </div>
                  ))}
                </div>
              )}
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

function evidenceStatus(item: EvidenceReference, asOf: string) {
  if (item.status === "carried") return { label: "Historical", tone: "carried" };
  const age = Math.floor((Date.parse(asOf) - Date.parse(item.lastChecked)) / 86_400_000);
  if (!Number.isFinite(age) || age < 0 || age > item.maxAgeDays) return { label: "Review due", tone: "due" };
  return { label: "Reviewed", tone: "reviewed" };
}

function SupportingHeading({ title, data, children }: { title: string; data: ExposureTraceData; children?: React.ReactNode }) {
  return <header className="trace-support-heading"><div><h2>{title}</h2><span>As of {data.asOf.slice(0, 10)}</span></div>{children}</header>;
}

function supportingEvidence(data: ExposureTraceData, trace: ExposureTrace) {
  const traceEvidenceIds = new Set([
    ...trace.hops.flatMap((hop) => hop.evidenceIds),
    ...trace.counterparties.flatMap((counterparty) => counterparty.evidenceIds),
    ...trace.commercialEvaluation.observedInputIds.flatMap((id) => data.commercialInputs.find((input) => input.inputId === id)?.evidenceIds ?? []),
    ...(trace.flowPressure?.evidenceIds ?? []),
    ...(trace.alternatives ?? []).flatMap((item) => item.evidenceIds),
    ...(trace.physicalFlow?.observations ?? []).flatMap((item) => item.evidenceIds),
  ]);
  const evidence = data.evidence.filter((item) => traceEvidenceIds.has(item.id));
  const traceInputIds = new Set([
    ...trace.hops.flatMap((hop) => hop.metrics.map((metric) => metric.inputId)),
    ...trace.commercialEvaluation.observedInputIds,
  ]);
  const machineIds = new Set((trace.physicalFlow?.observations ?? []).flatMap((item) => item.machineEvidenceIds ?? []));
  const machineEvidence = (data.machineEvidence ?? []).filter((item) =>
    machineIds.has(item.id) || item.targetInputIds.some((id) => traceInputIds.has(id))
      || item.targetCommercialInputIds.some((id) => traceInputIds.has(id)),
  );
  return { evidence, machineEvidence };
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

export function TraceEvidencePanel({ data, activeTraceId, onTraceChange }: TracePanelProps) {
  const trace = getActiveTrace(data, activeTraceId);
  const [query, setQuery] = useState("");
  if (!trace) return null;
  const { evidence, machineEvidence } = supportingEvidence(data, trace);
  const search = query.trim().toLowerCase();
  const visibleEvidence = evidence.filter((item) => `${item.title} ${item.publisher} ${item.publishedAt} ${evidenceStatus(item, data.asOf).label}`.toLowerCase().includes(search));
  const visibleMachine = machineEvidence.filter((item) => `${item.provider} ${item.sourceId} ${item.retrievedAt} snapshot`.toLowerCase().includes(search));
  const historical = evidence.filter((item) => item.status === "carried").length;

  return (
    <div className="trace-support" style={{ fontFamily: FONT_SANS }}>
      <TraceSelector data={data} activeTraceId={trace.id} onTraceChange={onTraceChange} />
      <SupportingHeading title="Evidence" data={data}><span>{evidence.length} sources · {historical} historical · {machineEvidence.length} snapshots</span></SupportingHeading>
      <label className="trace-evidence-search">Find a source<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Publisher, title or date" /></label>
      <div className="trace-evidence-list">
        {visibleEvidence.map((item) => {
          const status = evidenceStatus(item, data.asOf);
          return (
            <details key={`${trace.id}:${item.id}`} className="trace-support-card trace-evidence-item">
              <summary>
                <span className="trace-evidence-publisher">{item.publisher}</span>
                <span className="trace-evidence-title">{item.title}</span>
                <span className={`trace-status trace-status-${status.tone}`}>{status.label}</span>
                <span className="trace-evidence-date">{item.publishedAt}</span>
                <span className="trace-support-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="trace-support-detail">
                <a href={item.url} target="_blank" rel="noreferrer">Open source ↗</a>
                <p>Published {item.publishedAt} · Last checked {item.lastChecked} · {item.kind.replace(/-/g, " ")}</p>
                {item.note && <p>{item.note}</p>}
              </div>
            </details>
          );
        })}
      </div>
      {visibleMachine.length > 0 && <section className="trace-machine-section"><h3>Machine snapshots</h3>
        <div className="trace-evidence-list">{visibleMachine.map((item) => (
          <details key={`${trace.id}:${item.id}`} className="trace-support-card trace-evidence-item">
            <summary><span className="trace-evidence-publisher">{item.provider}</span><span className="trace-evidence-title">{item.recordKeys.length} validated record{item.recordKeys.length === 1 ? "" : "s"}</span><span className="trace-status">Snapshot</span><span className="trace-evidence-date">{item.retrievedAt.slice(0, 10)}</span><span className="trace-support-chevron" aria-hidden="true">⌄</span></summary>
            <div className="trace-support-detail"><a href={item.url} target="_blank" rel="noreferrer">Open source ↗</a><p>Observed {item.observedAt ?? "date unavailable"} · Retrieved {item.retrievedAt}</p><p>Source: {item.sourceId} · Parser: {item.parserVersion}</p><p>Validated retrieval does not establish current coverage or commercial eligibility.</p></div>
          </details>
        ))}</div>
      </section>}
      {visibleEvidence.length === 0 && visibleMachine.length === 0 && <p className="trace-support-empty" role="status">{search ? "No sources match your search." : "No supporting evidence available for this trace."}</p>}
      <p className="trace-evidence-rule">Historical and missing observations remain outside commercial calculations. Reviewed sources do not establish current cargo availability.</p>
    </div>
  );
}
