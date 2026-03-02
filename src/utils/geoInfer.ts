import type { EventCategory, EventImpact } from "../types";

export interface GeoResult {
  coordinates: [number, number];
  country: string;
  region: string;
}

// Longer/more-specific phrases must come before shorter substrings
export const COORD_MAP: Array<[string, [number, number], string, string]> = [
  ["south china sea", [114.0, 13.0], "Philippines",    "South China Sea"],
  ["strait of hormuz",[56.5,  26.5], "Iran",           "Middle East"],
  ["hormuz",          [56.5,  26.5], "Iran",           "Middle East"],
  ["philippines",     [121.0, 14.6], "Philippines",    "Southeast Asia"],
  ["vietnam",         [106.0, 16.0], "Vietnam",        "Southeast Asia"],
  ["thailand",        [100.5, 13.8], "Thailand",       "Southeast Asia"],
  ["indonesia",       [106.8, -6.2], "Indonesia",      "Southeast Asia"],
  ["myanmar",         [ 96.1, 19.7], "Myanmar",        "Southeast Asia"],
  ["malaysia",        [101.7,  3.1], "Malaysia",       "Southeast Asia"],
  ["cambodia",        [104.9, 11.6], "Cambodia",       "Southeast Asia"],
  ["laos",            [102.6, 18.0], "Laos",           "Southeast Asia"],
  ["singapore",       [103.8,  1.4], "Singapore",      "Southeast Asia"],
  ["asean",           [108.0, 10.0], "ASEAN",          "Southeast Asia"],
  ["taiwan",          [121.0, 23.5], "Taiwan",         "East Asia"],
  ["china",           [116.4, 39.9], "China",          "East Asia"],
  ["japan",           [138.0, 36.0], "Japan",          "East Asia"],
  ["korea",           [127.0, 37.5], "South Korea",    "East Asia"],
  ["hong kong",       [114.2, 22.3], "Hong Kong",      "East Asia"],
  ["india",           [ 79.5, 20.0], "India",          "South Asia"],
  ["pakistan",        [ 69.3, 30.4], "Pakistan",       "South Asia"],
  ["bangladesh",      [ 90.4, 23.7], "Bangladesh",     "South Asia"],
  ["afghanistan",     [ 69.2, 34.5], "Afghanistan",    "South Asia"],
  ["gaza",            [ 34.5, 31.5], "Gaza",           "Middle East"],
  ["israel",          [ 35.2, 31.8], "Israel",         "Middle East"],
  ["iran",            [ 51.4, 35.7], "Iran",           "Middle East"],
  ["iraq",            [ 44.4, 33.3], "Iraq",           "Middle East"],
  ["saudi",           [ 45.1, 24.7], "Saudi Arabia",   "Middle East"],
  ["syria",           [ 38.3, 34.8], "Syria",          "Middle East"],
  ["lebanon",         [ 35.5, 33.9], "Lebanon",        "Middle East"],
  ["turkey",          [ 35.2, 39.9], "Turkey",         "Middle East"],
  ["yemen",           [ 48.5, 15.6], "Yemen",          "Middle East"],
  ["ukraine",         [ 31.2, 49.0], "Ukraine",        "Europe"],
  ["russia",          [ 37.6, 55.8], "Russia",         "Europe"],
  ["united states",   [-77.0, 38.9], "United States",  "North America"],
  ["trump",           [-77.0, 38.9], "United States",  "North America"],
  ["federal reserve", [-77.0, 38.9], "United States",  "North America"],
  ["crypto",          [-77.0, 38.9], "United States",  "Global"],
  ["bitcoin",         [-77.0, 38.9], "United States",  "Global"],
  ["oil price",       [ 45.1, 24.7], "Saudi Arabia",   "Middle East"],
  ["crude oil",       [ 51.4, 35.7], "Iran",           "Middle East"],
  ["sanctions",       [ 51.4, 35.7], "Iran",           "Middle East"],
];

export const CATEGORY_MAP: Array<[EventCategory, string[]]> = [
  ["security",   ["invade", "invasion", "military", "clash", "strike", "blockade", "war", "attack", "conflict", "nuclear", "battle", "explosion", "riot", "armed", "troops", "missile", "violence", "airstrike"]],
  ["election",   ["election", "seats", "vote", "legislative", "referendum", "ballot", "nominee", "campaign"]],
  ["economic",   ["trade", "gdp", "tariff", "export", "bitcoin", "economic", "brics", "bank", "currency", "sanctions", "oil price", "market", "inflation", "supply chain", "crude"]],
  ["climate",    ["typhoon", "flood", "drought", "climate", "mekong", "earthquake", "storm", "cyclone", "wildfire", "tsunami"]],
  ["diplomatic", ["visit", "relations", "normalize", "meet", "summit", "agreement", "treaty", "diplomat", "recognize", "talks", "ceasefire", "deal", "alliance"]],
  ["political",  ["president", "prime minister", "pm ", "coup", "ousted", "leader", "government", "minister", "resign", "protest", "demonstration", "opposition"]],
];

export function inferGeo(text: string): GeoResult | null {
  const t = text.toLowerCase();
  for (const [kw, coords, country, region] of COORD_MAP) {
    if (t.includes(kw)) return { coordinates: coords, country, region };
  }
  return null;
}

export function inferCategory(text: string): EventCategory {
  const t = text.toLowerCase();
  for (const [cat, kws] of CATEGORY_MAP) {
    if (kws.some(k => t.includes(k))) return cat;
  }
  return "political";
}

export function inferImpact(score: number): EventImpact {
  if (score >= 70) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/** Deterministic angular jitter so overlapping events don't stack exactly */
export function jitterCoords(coords: [number, number], idx: number): [number, number] {
  const angle = (idx * 137.508) * (Math.PI / 180);
  const r = 0.6;
  return [coords[0] + Math.cos(angle) * r, coords[1] + Math.sin(angle) * r];
}
