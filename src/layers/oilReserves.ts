import reservesData from "../data/oil-reserves.json";

export const OIL_RESERVES_MAP = new Map<string, number>(
  Object.entries(reservesData as Record<string, number>)
);

// Venezuela ~304B barrels is the global maximum
const MAX_RESERVES = 304;

// Natural Earth ADMIN names → proven reserves (billions of barrels)
// Primary lookup — more reliable than ISO_A3 in NE 3.3.0
const ADMIN_RESERVES: Record<string, number> = {
  "Venezuela":                        303.8,
  "Saudi Arabia":                     267.2,
  "Iran":                             208.6,
  "Canada":                           170.3,
  "Iraq":                             145.0,
  "United Arab Emirates":             113.0,
  "Kuwait":                           101.5,
  "Russia":                            80.0,
  "United States of America":          68.8,
  "Libya":                             48.8,
  "Nigeria":                           37.1,
  "Kazakhstan":                        30.0,
  "China":                             26.0,
  "Qatar":                             25.2,
  "Brazil":                            13.0,
  "Algeria":                           12.2,
  "Guyana":                            11.0,
  "Ecuador":                            8.3,
  "Norway":                             8.1,
  "Angola":                             7.8,
  "Azerbaijan":                         7.0,
  "Mexico":                             6.0,
  "Oman":                               5.4,
  "India":                              4.6,
  "Vietnam":                            4.4,
  "South Sudan":                        3.8,
  "Malaysia":                           3.6,
  "Egypt":                              3.3,
  "Yemen":                              3.0,
  "Argentina":                          3.0,
  "United Kingdom":                     2.5,
  "Syria":                              2.5,
  "Uganda":                             2.5,
  "Indonesia":                          2.5,
  "Australia":                          2.4,
  "Suriname":                           2.4,
  "Colombia":                           2.0,
  "Gabon":                              2.0,
  "Republic of Congo":                  1.8,
  "Congo":                              1.8,
  "Chad":                               1.5,
  "Turkey":                             1.4,
  "Sudan":                              1.3,
  "Brunei":                             1.1,
  "Equatorial Guinea":                  1.1,
  "Senegal":                            1.0,
  "Peru":                               0.9,
  "Ghana":                              0.7,
  "Timor-Leste":                        0.7,
  "East Timor":                         0.7,
  "Romania":                            0.6,
  "Turkmenistan":                       0.6,
  "Uzbekistan":                         0.6,
  "Kenya":                              0.6,
  "Pakistan":                           0.5,
  "Italy":                              0.5,
  "Denmark":                            0.4,
  "Tunisia":                            0.4,
  "Ukraine":                            0.4,
  "Thailand":                           0.3,
  "Trinidad and Tobago":                0.2,
  "Bolivia":                            0.2,
  "Cameroon":                           0.2,
  "Belarus":                            0.2,
  "Bahrain":                            0.2,
  "Democratic Republic of the Congo":   0.2,
  "Dem. Rep. Congo":                    0.2,
  "Papua New Guinea":                   0.2,
  "Albania":                            0.2,
  "Niger":                              0.2,
  "Mongolia":                           0.2,
  "Spain":                              0.2,
  "Chile":                              0.15,
  "Philippines":                        0.14,
  "Myanmar":                            0.1,
  "Netherlands":                        0.1,
  "Cuba":                               0.1,
  "Germany":                            0.1,
  "Poland":                             0.1,
  "Ivory Coast":                        0.1,
  "Côte d'Ivoire":                      0.1,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getOilReservesFillColor(feature: any): [number, number, number, number] {
  const props = feature?.properties ?? {};

  // 1. ADMIN name primary (most reliable for Natural Earth GeoJSON)
  const admin: string = props.ADMIN ?? props.NAME ?? props.name ?? "";
  let reserves: number | undefined = ADMIN_RESERVES[admin];

  // 2. ISO_A3 fallback with normalization
  if (reserves === undefined) {
    const iso = (props.ISO_A3 ?? "").toString().trim().toUpperCase();
    if (iso && iso !== "-99") reserves = OIL_RESERVES_MAP.get(iso);
  }

  if (reserves === undefined) return [8, 14, 28, 255]; // same as base dark fill

  const t = Math.sqrt(reserves / MAX_RESERVES);
  const r = Math.round(130 + t * 125); // 130 → 255
  const g = Math.round(15  + t * 35);  // 15  → 50
  const b = Math.round(15  + t * 15);  // 15  → 30

  return [r, g, b, 230];
}
