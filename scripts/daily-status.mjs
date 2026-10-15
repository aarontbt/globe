import { execFileSync } from "node:child_process";
import {
  LONG_CARRIED_DAYS,
  PATHS,
  ageInDays,
  collectStaleObservations,
  formatDateOnly,
  loadState,
  readJson,
} from "./daily-common.mjs";

// Read-only daily planner: lists the evidence that must be re-scraped, every stale or
// carried observation, and whether trace changes require a browser review.

const asOfArg = process.argv.find((arg) => arg.startsWith("--as-of="));
const today = asOfArg ? asOfArg.slice("--as-of=".length) : new Date().toISOString().slice(0, 10);

const state = loadState();
const exposure = readJson(PATHS.exposure);
const audit = readJson(PATHS.evidenceAudit);
const auditById = new Map((audit.entries ?? []).map((entry) => [entry.evidenceId, entry]));
const evidenceUpdates = state.traceInputs?.evidenceUpdates ?? {};

function effectiveEvidence(item) {
  return { ...item, ...(evidenceUpdates[item.id] ?? {}) };
}

function headState(relativePath) {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${relativePath}`], { cwd: PATHS.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return null;
  }
}

// 1. Evidence due for a Firecrawl review.
const due = [];
for (const raw of exposure.evidence ?? []) {
  const item = effectiveEvidence(raw);
  const entry = auditById.get(item.id);
  const checkedAt = entry?.checkedAt ? formatDateOnly(entry.checkedAt) : null;
  const age = checkedAt ? ageInDays(today, checkedAt) : Number.NaN;
  let reason = null;
  if (!entry) reason = "no audit entry";
  else if (checkedAt !== item.lastChecked) reason = `lastChecked ${item.lastChecked} != audit ${checkedAt}`;
  else if (entry.url !== item.url) reason = "URL changed";
  else if (item.status !== "carried" && age > Number(item.maxAgeDays)) reason = `overdue (${age}d > ${item.maxAgeDays}d)`;
  else if (item.status !== "carried" && age >= Number(item.maxAgeDays)) reason = `expires before next run (${age}d of ${item.maxAgeDays}d)`;
  if (reason) due.push({ id: item.id, publisher: item.publisher, reason, url: item.url });
}

// 2. Stale, carried and estimated observations.
const stale = collectStaleObservations(state, today);

// 3. Review triggers versus the committed state.
const triggers = [];
const headDaily = headState("src/data/daily-state.json");
const headExposure = headState("src/data/exposure-traces.json");
if (headDaily) {
  for (const [group, current, previous] of [
    ["trace", state.traceInputs?.metrics ?? {}, headDaily.traceInputs?.metrics ?? {}],
    ["commercial", state.commercialInputs ?? {}, headDaily.commercialInputs ?? {}],
  ]) {
    for (const [id, record] of Object.entries(current)) {
      const before = previous[id]?.status;
      if (before !== record.status) triggers.push(`${group} ${id}: ${before ?? "new"} -> ${record.status}`);
    }
  }
}
if (headExposure) {
  const previousTraces = new Map((headExposure.traces ?? []).map((trace) => [trace.id, trace]));
  for (const trace of exposure.traces ?? []) {
    const before = previousTraces.get(trace.id);
    if (!before) {
      triggers.push(`trace ${trace.id}: new`);
      continue;
    }
    const pick = (t) => JSON.stringify({
      directions: t.hops?.map((hop) => hop.direction),
      alternatives: t.alternatives?.map((alt) => [alt.id, alt.feasibility]),
      counterparties: t.counterparties?.map((cp) => cp.id ?? cp.name),
    });
    if (pick(trace) !== pick(before)) triggers.push(`trace ${trace.id}: direction, alternative or counterparty changed`);
  }
}
const commercialChange = triggers.some((t) => t.startsWith("commercial") && !/-> (unavailable|carried)$/.test(t));

// Output.
console.log(`Daily status for ${today} (state asOf ${formatDateOnly(state.asOf)}, ${state.day})\n`);

console.log(`Evidence to scrape: ${due.length} of ${(exposure.evidence ?? []).length}`);
for (const item of due) console.log(`  - ${item.id} [${item.publisher}] ${item.reason}\n      ${item.url}`);

const longCarried = stale.filter((item) => item.long);
console.log(`\nStale / carried / estimated: ${stale.length} (${longCarried.length} held past max(${LONG_CARRIED_DAYS}d, cadence) - search for a replacement source)`);
for (const item of stale) {
  console.log(`  ${item.long ? "!" : "-"} ${item.scope} ${item.id}: ${item.status} since ${item.sourceDate} (${Number.isFinite(item.age) ? `${item.age}d` : "undated"})`);
}

console.log(`\nReview triggers vs HEAD: ${triggers.length ? "" : "none - skip the browser Flow Pressure / trace review"}`);
for (const trigger of triggers) console.log(`  - ${trigger}`);
if (triggers.length) console.log("  -> Review the affected trace(s) in SIGNAL -> EXPOSURE before publishing.");
console.log(`Commercial evaluation review: ${commercialChange ? "REQUIRED (a commercial input changed status)" : "skip (no commercial input became usable)"}`);
