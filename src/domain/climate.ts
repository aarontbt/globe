import type { ClimateAlertLevel, ClimateHazard, ClimateSourceFreshness, ClimateSourceStatus } from "../types/climate";

export const CLIMATE_ALERT_COLORS: Record<ClimateAlertLevel, [number, number, number]> = {
  green: [74, 222, 128],
  orange: [251, 146, 60],
  red: [248, 113, 113],
  unknown: [148, 163, 184],
};

export function resolveClimateFreshness(source: ClimateSourceStatus, now = Date.now()): ClimateSourceFreshness {
  if (!source.lastSuccessfulAt) return source.status;
  const lastSuccess = Date.parse(source.lastSuccessfulAt);
  if (!Number.isFinite(lastSuccess)) return "unavailable";
  return now - lastSuccess > source.freshnessHours * 3_600_000 ? "stale" : "fresh";
}

export function formatClimateTime(value: string | null): string {
  if (!value) return "Not available";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
}

export function isClimateHazardActive(hazard: ClimateHazard, now = Date.now()): boolean {
  if (!hazard.validTo) return true;
  const validTo = Date.parse(hazard.validTo);
  return Number.isFinite(validTo) && validTo >= now;
}
