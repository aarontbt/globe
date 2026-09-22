import fs from "node:fs";
import path from "node:path";
import { PATHS, readJson } from "./daily-common.mjs";

const MODEL = "jev-latest";
const UPSTREAM = "https://api.typesafe.ai/v1/systemone";
const SUPPORT_CLASSES = ["direct", "partial", "mischaracterized", "unsupported"];
const FEASIBILITY_CLASSES = [
  "potential",
  "physically-feasible",
  "commercially-executable",
  "insufficient-verified-data",
];

function parseArgs(argv) {
  const outIndex = argv.indexOf("--out");
  return {
    out: outIndex >= 0 ? argv[outIndex + 1] : null,
    dryRun: argv.includes("--dry-run"),
  };
}

function numberValue(value, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function answer(response, key) {
  return response?.answers?.[key] ?? null;
}

function evidenceClaims(exposure) {
  const claims = new Map();
  for (const trace of exposure.traces ?? []) {
    for (const hop of trace.hops ?? []) {
      for (const metric of hop.metrics ?? []) {
        claims.set(metric.inputId, {
          id: metric.inputId,
          label: metric.label,
          value: metric.value ?? (metric.low !== undefined ? `${metric.low}-${metric.high}` : "unavailable"),
          unit: metric.unit ?? "",
          sourceDate: metric.sourceDate ?? "",
          status: metric.status,
        });
      }
    }
  }
  for (const input of exposure.commercialInputs ?? []) {
    claims.set(input.inputId, {
      id: input.inputId,
      label: input.label,
      value: input.value ?? (input.low !== undefined ? `${input.low}-${input.high}` : "unavailable"),
      unit: input.unit ?? "",
      sourceDate: input.sourceDate ?? "",
      status: input.status,
    });
  }
  return claims;
}

function buildEvidenceCases(exposure, audit) {
  const claims = evidenceClaims(exposure);
  return (audit.entries ?? []).map((entry) => {
    const linkedClaims = [
      ...(entry.supportedMetricIds ?? []),
      ...(entry.supportedCommercialInputIds ?? []),
      ...(entry.supportedDerivedMetricIds ?? []),
    ]
      .map((id) => claims.get(id))
      .filter(Boolean);

    return {
      id: entry.evidenceId,
      claim: [
        entry.claimSummary,
        linkedClaims.length > 0
          ? `Published fields linked to this evidence: ${JSON.stringify(linkedClaims)}`
          : "No published metric field is linked to this evidence.",
      ].join("\n"),
      evidence: [
        `${entry.title} — ${entry.publisher} — published ${entry.publishedAt}`,
        ...(entry.extractedFacts ?? []),
        ...(entry.observations ?? []).map((observation) =>
          `${observation.inputId}: ${observation.value} ${observation.unit} on ${observation.sourceDate} (${observation.provider})`,
        ),
      ].join("\n"),
    };
  });
}

function buildAlternativeCases(exposure) {
  return (exposure.traces ?? []).flatMap((trace) =>
    (trace.alternatives ?? []).map((alternative) => ({
      id: `${trace.id}:${alternative.id}`,
      traceId: trace.id,
      label: alternative.label,
      description: alternative.summary,
      declaredFeasibility: alternative.feasibility,
      constraints: alternative.constraintSummary,
      evidenceIds: alternative.evidenceIds ?? [],
    })),
  );
}

function buildQuestions(evidenceCases, alternativeCases) {
  const questions = {};
  for (let index = 0; index < evidenceCases.length; index += 1) {
    questions[`evidence_${index}_support`] = {
      type: "choice",
      instructions: `Classify the support for the claim in \`evidenceCases[${index}]\` against its evidence.`,
      criteria: {
        direct: "The evidence supports the claim facts, quantity, unit, scope and time.",
        partial: "The evidence supports some but not all material parts of the claim.",
        mischaracterized: "The evidence explicitly conflicts with how the claim labels or interprets the fact.",
        unsupported: "The evidence does not support the material claim.",
      },
    };
    questions[`evidence_${index}_review`] = {
      type: "noul",
      instructions: `Does \`evidenceCases[${index}]\` require human review before it can be published as a verified fact?`,
    };
  }
  for (let index = 0; index < alternativeCases.length; index += 1) {
    questions[`alternative_${index}_feasibility`] = {
      type: "choice",
      instructions: `Classify the execution feasibility of \`alternativeCases[${index}]\`.`,
      criteria: {
        potential: "A plausible candidate with some relevant context, but execution evidence is missing.",
        "physically-feasible": "Demonstrated capacity, compatible infrastructure and route or lead-time constraints are evidenced, but commercial execution is incomplete.",
        "commercially-executable": "Capacity, availability, infrastructure, timing, cost, sanctions or insurance and contract execution are all evidenced.",
        "insufficient-verified-data": "The candidate lacks enough reliable evidence even to establish a plausible path.",
      },
    };
    questions[`alternative_${index}_review`] = {
      type: "noul",
      instructions: `Does \`alternativeCases[${index}]\` require additional evidence review before it can be described as executable?`,
    };
  }
  return questions;
}

async function callTypeSafe(state, questions) {
  const response = await fetch(UPSTREAM, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ model: MODEL, state, questions }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`TypeSafe API ${response.status}: ${body.slice(0, 240)}`);
  return JSON.parse(body);
}

function buildResult(response, asOf, evidenceCases, alternativeCases) {
  return {
    schemaVersion: 1,
    status: "complete",
    asOf,
    evaluatedAt: new Date().toISOString(),
    model: response.model ?? MODEL,
    evidence: evidenceCases.map((entry, index) => {
      const support = answer(response, `evidence_${index}_support`);
      const review = answer(response, `evidence_${index}_review`);
      return {
        evidenceId: entry.id,
        supportClass: SUPPORT_CLASSES.includes(support?.choice) ? support.choice : "unsupported",
        supportConfidence: numberValue(support?.confidence),
        requiresReview: numberValue(review?.noul),
      };
    }),
    alternatives: alternativeCases.map((entry, index) => {
      const feasibility = answer(response, `alternative_${index}_feasibility`);
      const review = answer(response, `alternative_${index}_review`);
      return {
        id: entry.id,
        traceId: entry.traceId,
        label: entry.label,
        declaredFeasibility: entry.declaredFeasibility,
        semanticFeasibility: FEASIBILITY_CLASSES.includes(feasibility?.choice)
          ? feasibility.choice
          : "insufficient-verified-data",
        feasibilityConfidence: numberValue(feasibility?.confidence),
        requiresReview: numberValue(review?.noul),
      };
    }),
    usage: response.usage ?? null,
  };
}

function emit(result, out) {
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (out) {
    const target = path.resolve(out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serialized);
  } else {
    process.stdout.write(serialized);
  }
}

async function main() {
  const { out, dryRun } = parseArgs(process.argv.slice(2));
  if (!process.env.TYPESAFE_API_KEY || process.env.TYPESAFE_ENABLED === "false") {
    emit({
      schemaVersion: 1,
      status: "skipped",
      reason: "TypeSafe is not enabled; existing deterministic review remains authoritative.",
    }, out);
    return;
  }

  const exposure = readJson(PATHS.exposure);
  const audit = readJson(PATHS.evidenceAudit);
  const evidenceCases = buildEvidenceCases(exposure, audit);
  const alternativeCases = buildAlternativeCases(exposure);
  const state = {
    product_scope: "An evidence-backed energy and maritime intelligence assessment.",
    review_rule: "TypeSafe is advisory. It may identify semantic mismatch or missing execution evidence, but it cannot approve evidence, change source status, or upgrade alternative feasibility.",
    evidenceCases,
    alternativeCases,
  };

  if (dryRun) {
    emit({
      schemaVersion: 1,
      status: "dry-run",
      asOf: exposure.asOf,
      evidenceCases: evidenceCases.length,
      alternativeCases: alternativeCases.length,
      questionCount: Object.keys(buildQuestions(evidenceCases, alternativeCases)).length,
    }, out);
    return;
  }

  try {
    const response = await callTypeSafe(state, buildQuestions(evidenceCases, alternativeCases));
    emit(buildResult(response, exposure.asOf, evidenceCases, alternativeCases), out);
  } catch (error) {
    emit({
      schemaVersion: 1,
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
      existingDeterministicReview: "unchanged",
    }, out);
  }
}

await main();
