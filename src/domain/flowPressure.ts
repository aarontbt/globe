import type {
  EnergyAlternative,
  EnergyLngAssessment,
  EnergyLngConfidence,
  EnergyLngEntityKind,
  EnergyLngHop,
  EnergyLngObservation,
  FlowPressureAssessment,
  FlowPressureComponent,
  FlowPressureComponentId,
} from "../types/energyLng";

/**
 * Flow Pressure v1 is an explainable pressure index, not a market forecast.
 * Each component is scored from 0 (no observed pressure) to 100 (high
 * pressure), then combined using these fixed weights. Unknown inputs remain
 * neutral at 50 and reduce confidence; they are never silently estimated.
 */
export const FLOW_PRESSURE_WEIGHTS: Record<FlowPressureComponentId, number> = {
  "supply-interruption": 0.25,
  "route-chokepoint-pressure": 0.2,
  "vessel-port-disruption": 0.15,
  "destination-dependency": 0.15,
  "price-basis-movement": 0.15,
  "alternative-availability": 0.1,
};

const COMPONENT_LABELS: Record<FlowPressureComponentId, string> = {
  "supply-interruption": "Supply interruption",
  "route-chokepoint-pressure": "Route / chokepoint pressure",
  "vessel-port-disruption": "Vessel / port disruption",
  "destination-dependency": "Destination dependency",
  "price-basis-movement": "Price / basis movement",
  "alternative-availability": "Alternative availability",
};

const DIRECTIONAL_PRESSURE: Record<EnergyLngHop["direction"], number> = {
  negative: 75,
  mixed: 50,
  positive: 25,
};

const CONFIDENCE_RANK: Record<EnergyLngConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function lowerConfidence(left: EnergyLngConfidence, right: EnergyLngConfidence): EnergyLngConfidence {
  return CONFIDENCE_RANK[left] <= CONFIDENCE_RANK[right] ? left : right;
}

function metricStatus(observation: EnergyLngObservation): "observed" | "carried" | "unavailable" {
  if (observation.record.status === "confirmed") return "observed";
  if (observation.record.status === "carried") return "carried";
  return "unavailable";
}

function evaluateHopGroup(
  hops: EnergyLngHop[],
  observationsById: Map<string, EnergyLngObservation>,
  label: string,
): Omit<FlowPressureComponent, "id" | "label" | "weight"> {
  if (hops.length === 0) {
    return {
      score: 50,
      status: "unresolved",
      confidence: "unknown",
      rationale: `No ${label.toLowerCase()} observation is present in this assessment.`,
      observationIds: [],
      evidenceIds: [],
    };
  }

  const scores: number[] = [];
  const observationIds = new Set<string>();
  const evidenceIds = new Set<string>();
  let status: FlowPressureComponent["status"] = "observed";
  let confidence: EnergyLngConfidence = "high";

  for (const hop of hops) {
    const observations = hop.observationIds
      .map((id) => observationsById.get(id))
      .filter((observation): observation is EnergyLngObservation => Boolean(observation));
    const statuses = observations.map(metricStatus);
    const hasUnavailable = statuses.length === 0 || statuses.includes("unavailable");
    const hasCarried = statuses.includes("carried");
    const baseScore = DIRECTIONAL_PRESSURE[hop.direction];
    let score = baseScore;

    for (const observation of observations) {
      observationIds.add(observation.id);
      observation.evidenceIds.forEach((id) => evidenceIds.add(id));
    }
    hop.evidenceIds.forEach((id) => evidenceIds.add(id));

    if (hasUnavailable && statuses.every((item) => item === "unavailable")) {
      score = 50;
      status = "unresolved";
      confidence = lowerConfidence(confidence, "unknown");
    } else if (hasUnavailable) {
      score = baseScore * 0.7 + 50 * 0.3;
      status = "partially-observed";
      confidence = lowerConfidence(confidence, "low");
    } else if (hasCarried) {
      score = baseScore * 0.85 + 50 * 0.15;
      status = status === "unresolved" ? status : "partially-observed";
      confidence = lowerConfidence(confidence, "medium");
    }

    scores.push(score);
  }

  const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  const statusText = status === "observed"
    ? "supported by the reviewed observations"
    : status === "partially-observed"
      ? "partly supported; carried or missing observations reduce confidence"
      : "unresolved because the required observation is unavailable";

  return {
    score,
    status,
    confidence,
    rationale: `${label} is scored from the direction of the relevant trace hop(s); ${statusText}.`,
    observationIds: [...observationIds],
    evidenceIds: [...evidenceIds],
  };
}

function evaluatePriceMovement(
  hops: EnergyLngHop[],
  observationsById: Map<string, EnergyLngObservation>,
): Omit<FlowPressureComponent, "id" | "label" | "weight"> {
  const marketHops = hops.filter((hop) => hop.stage === "demand");
  const base = evaluateHopGroup(marketHops, observationsById, "Price / basis");
  const observations = base.observationIds
    .map((id) => observationsById.get(id))
    .filter((observation): observation is EnergyLngObservation => Boolean(observation));
  const hasExplicitMovement = observations.some((observation) =>
    /basis|spread|change|movement|premium|discount|delta/i.test(observation.label),
  );

  if (hasExplicitMovement) return base;

  return {
    ...base,
    score: 50,
    status: base.status === "unresolved" ? "unresolved" : "partially-observed",
    confidence: lowerConfidence(base.confidence, "low"),
    rationale: "Market observations are present, but the fixture does not contain an explicit price or basis movement observation.",
  };
}

function evaluateAlternatives(alternatives: EnergyAlternative[]): Omit<FlowPressureComponent, "id" | "label" | "weight"> {
  if (alternatives.length === 0) {
    return {
      score: 50,
      status: "unresolved",
      confidence: "unknown",
      rationale: "No ranked alternative source, market, route or terminal is currently present in the reviewed data.",
      observationIds: [],
      evidenceIds: [],
    };
  }

  const pressureByFeasibility: Record<EnergyAlternative["feasibility"], number> = {
    "potential": 70,
    "physically-feasible": 35,
    "commercially-executable": 15,
    "insufficient-verified-data": 50,
  };
  const score = Math.round(
    alternatives.reduce((sum, alternative) => sum + pressureByFeasibility[alternative.feasibility], 0) / alternatives.length,
  );
  const hasUnverified = alternatives.some((alternative) => alternative.feasibility === "insufficient-verified-data");
  const hasOnlyPotential = alternatives.every((alternative) => alternative.feasibility === "potential");
  const evidenceIds = [...new Set(alternatives.flatMap((alternative) => alternative.evidenceIds))];

  return {
    score,
    status: hasUnverified || hasOnlyPotential ? "partially-observed" : "observed",
    confidence: hasUnverified || hasOnlyPotential ? "low" : evidenceIds.length > 0 ? "medium" : "low",
    rationale: "Alternative pressure is ranked from candidate feasibility; commercial execution requires separate verified capacity, cost and contract evidence.",
    observationIds: [],
    evidenceIds,
  };
}

function component(
  id: FlowPressureComponentId,
  evaluated: Omit<FlowPressureComponent, "id" | "label" | "weight">,
): FlowPressureComponent {
  return {
    id,
    label: COMPONENT_LABELS[id],
    weight: FLOW_PRESSURE_WEIGHTS[id],
    ...evaluated,
  };
}

export function calculateFlowPressure(
  assessment: Pick<EnergyLngAssessment, "hops" | "alternatives">,
  observationsById: Map<string, EnergyLngObservation>,
  entityKindsById: Map<string, EnergyLngEntityKind>,
  calculatedAt: string,
): FlowPressureAssessment {
  const transportHops = assessment.hops.filter((hop) => hop.stage === "transport");
  const vesselOrPortHops = transportHops.filter((hop) =>
    hop.entityIds.some((entityId) => {
      const kind = entityKindsById.get(entityId);
      return kind === "vessel" || kind === "carrier" || kind === "port" || kind === "regas-terminal";
    }),
  );
  const destinationHops = assessment.hops.filter((hop) => hop.stage === "demand" || hop.stage === "counterparty");
  const components = [
    component("supply-interruption", evaluateHopGroup(assessment.hops.filter((hop) => hop.stage === "signal" || hop.stage === "supply"), observationsById, "Supply interruption")),
    component("route-chokepoint-pressure", evaluateHopGroup(transportHops, observationsById, "Route / chokepoint pressure")),
    component("vessel-port-disruption", evaluateHopGroup(vesselOrPortHops.length > 0 ? vesselOrPortHops : transportHops, observationsById, "Vessel / port disruption")),
    component("destination-dependency", evaluateHopGroup(destinationHops, observationsById, "Destination dependency")),
    component("price-basis-movement", evaluatePriceMovement(assessment.hops, observationsById)),
    component("alternative-availability", evaluateAlternatives(assessment.alternatives)),
  ];
  const score = Math.round(components.reduce((sum, item) => sum + item.score * item.weight, 0));
  const confidence = components.reduce<EnergyLngConfidence>(
    (current, item) => lowerConfidence(current, item.confidence),
    "high",
  );
  const status = components.every((item) => item.status === "observed")
    ? "assessed"
    : components.every((item) => item.status === "unresolved")
      ? "insufficient-verified-data"
      : "provisional";

  return {
    modelVersion: "flow-pressure-v1",
    score,
    status,
    confidence,
    calculatedAt,
    components,
    evidenceIds: [...new Set(components.flatMap((item) => item.evidenceIds))],
    note: "Higher scores indicate more pressure on the assessed physical flow. Missing or carried observations remain explicit and reduce confidence.",
  };
}
