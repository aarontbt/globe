import {
  PATHS,
  loadState,
  readJson,
  summarizeEvidenceAudit,
  validateEvidenceAudit,
} from "./daily-common.mjs";

const state = loadState();
const exposure = readJson(PATHS.exposure);
const audit = readJson(PATHS.evidenceAudit);
const errors = validateEvidenceAudit(state, exposure, audit);
const summary = summarizeEvidenceAudit(exposure, audit);
const verdict = errors.length ? "FAIL" : "PASS";

console.log(
  `Evidence audit: ${summary.checked} checked · ${summary.verified} verified · ${summary.carried} carried · ${summary.unsupported} unsupported · ${summary.pending} pending · ${verdict}`,
);

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
