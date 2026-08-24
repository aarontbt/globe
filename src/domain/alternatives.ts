import type { EnergyAlternative } from "../types/energyLng";

/**
 * Alternative ranking v1 deliberately ranks feasibility before convenience.
 * A commercially executable candidate outranks a merely physical candidate,
 * which outranks a potential candidate. Evidence count and analyst score are
 * tie-breakers; missing evidence never upgrades feasibility.
 */
export const ALTERNATIVE_RANKING_VERSION = "alternative-ranking-v1" as const;

const FEASIBILITY_PRIORITY: Record<EnergyAlternative["feasibility"], number> = {
  "commercially-executable": 3,
  "physically-feasible": 2,
  potential: 1,
  "insufficient-verified-data": 0,
};

export function rankAlternatives(alternatives: EnergyAlternative[]): EnergyAlternative[] {
  return [...alternatives]
    .sort((left, right) => {
      const feasibilityDelta = FEASIBILITY_PRIORITY[right.feasibility] - FEASIBILITY_PRIORITY[left.feasibility];
      if (feasibilityDelta !== 0) return feasibilityDelta;

      const evidenceDelta = right.evidenceIds.length - left.evidenceIds.length;
      if (evidenceDelta !== 0) return evidenceDelta;

      const scoreDelta = (right.score ?? Number.NEGATIVE_INFINITY) - (left.score ?? Number.NEGATIVE_INFINITY);
      if (scoreDelta !== 0) return scoreDelta;

      return left.label.localeCompare(right.label);
    })
    .map((alternative, index) => ({
      ...alternative,
      rank: index + 1,
    }));
}
