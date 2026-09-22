import type {
  GlobeEvent,
  TypeSafeEventTriage,
  TypeSafeSemanticClass,
} from "../types";

const MODEL = "jev-latest";
const MAX_BATCH_SIZE = 10;

const SEMANTIC_CRITERIA: Record<TypeSafeSemanticClass, string> = {
  "direct-flow": "Current concrete evidence can update an energy supply, transport, chokepoint, cargo or market assessment.",
  "decision-context": "Relevant security, diplomatic or policy context for monitoring, but not itself a physical-flow input.",
  "indirect-exposure": "Relevant downstream or adjacent-sector exposure, but not a core LNG or crude-flow observation.",
  irrelevant: "No meaningful linkage to the product's energy or maritime intelligence scope.",
  insufficient: "Too vague or lacking enough evidence to classify.",
};

const PRIORITY_CRITERIA = [
  "Ignore; no meaningful scope relevance.",
  "Keep as background context only.",
  "Review and possibly link to an existing assessment.",
  "Promote as a candidate update to an energy-flow alert or trace.",
];

interface TypeSafeAnswer {
  type?: string;
  choice?: unknown;
  score?: unknown;
  confidence?: unknown;
  noul?: unknown;
}

interface TypeSafeResponse {
  model?: unknown;
  answers?: Record<string, TypeSafeAnswer>;
}

let capability: boolean | null = null;
let capabilityRequest: Promise<boolean> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isSemanticClass(value: unknown): value is TypeSafeSemanticClass {
  return typeof value === "string" && value in SEMANTIC_CRITERIA;
}

function clientOptedIn(): boolean {
  if (import.meta.env.VITE_TYPESAFE_ENABLED === "false") return false;
  // Vite's local server only has the secret when the developer explicitly
  // exports it; production uses the server-side capability endpoint below.
  if (import.meta.env.DEV) return import.meta.env.VITE_TYPESAFE_ENABLED === "true";
  return true;
}

async function isTypeSafeAvailable(): Promise<boolean> {
  if (!clientOptedIn() || capability === false) return false;
  if (import.meta.env.DEV) return true;
  if (capability !== null) return capability;
  if (!capabilityRequest) {
    capabilityRequest = fetch("/api/typesafe?capability=1", {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = await response.json() as { enabled?: unknown };
        return body.enabled === true;
      })
      .catch(() => false);
  }
  capability = await capabilityRequest;
  return capability;
}

async function callTypeSafe(state: unknown, questions: Record<string, unknown>): Promise<TypeSafeResponse | null> {
  if (!(await isTypeSafeAvailable())) return null;

  try {
    const response = await fetch("/api/typesafe", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, state, questions }),
    });

    if (!response.ok) {
      capability = false;
      return null;
    }

    return await response.json() as TypeSafeResponse;
  } catch {
    capability = false;
    return null;
  }
}

function questionSet(size: number): Record<string, unknown> {
  const questions: Record<string, unknown> = {};
  for (let index = 0; index < size; index += 1) {
    const key = `event_${index}`;
    questions[`${key}_class`] = {
      type: "choice",
      instructions: `Classify \`cases[${index}]\` for this product.`,
      criteria: SEMANTIC_CRITERIA,
    };
    questions[`${key}_priority`] = {
      type: "score",
      instructions: `How urgently should an analyst review \`cases[${index}]\` for the next energy assessment update?`,
      criteria: PRIORITY_CRITERIA,
    };
    questions[`${key}_update_eligible`] = {
      type: "noul",
      instructions: `Does \`cases[${index}]\` contain a current, concrete observation that should be eligible to update an energy-flow or market assessment?`,
    };
  }
  return questions;
}

/**
 * Adds advisory semantic triage to a bounded batch of live social events.
 * Empty results are intentional: the caller keeps the existing deterministic
 * event behavior when TypeSafe is unavailable, disabled, or unsuccessful.
 */
export async function triageEvents(events: GlobeEvent[]): Promise<Map<string, TypeSafeEventTriage>> {
  const candidates = events
    .filter((event) => Boolean(event.title || event.description))
    .slice(0, MAX_BATCH_SIZE);
  if (candidates.length === 0) return new Map();

  const state = {
    product_scope: "An evidence-backed energy and maritime intelligence globe.",
    cases: candidates.map((event) => ({
      id: event.id,
      title: event.title,
      text: event.description,
      tags: event.tags,
      source_class: event.social?.platform ?? "live-feed",
    })),
  };

  const response = await callTypeSafe(state, questionSet(candidates.length));
  const answers = response?.answers;
  if (!answers) return new Map();

  const evaluatedAt = new Date().toISOString();
  const model = typeof response.model === "string" ? response.model : MODEL;
  const results = new Map<string, TypeSafeEventTriage>();

  candidates.forEach((event, index) => {
    const key = `event_${index}`;
    const classAnswer = answers[`${key}_class`];
    const priorityAnswer = answers[`${key}_priority`];
    const updateAnswer = answers[`${key}_update_eligible`];
    if (!classAnswer || !priorityAnswer || !updateAnswer || !isSemanticClass(classAnswer.choice)) return;

    results.set(event.id, {
      semanticClass: classAnswer.choice,
      semanticConfidence: clamp(numberValue(classAnswer.confidence), 0, 1),
      priorityScore: clamp(numberValue(priorityAnswer.score), 0, PRIORITY_CRITERIA.length - 1),
      priorityConfidence: clamp(numberValue(priorityAnswer.confidence), 0, 1),
      updateEligible: clamp(numberValue(updateAnswer.noul), 0, 1),
      model,
      evaluatedAt,
    });
  });

  return results;
}
