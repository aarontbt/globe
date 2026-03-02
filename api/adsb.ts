import type { VercelRequest, VercelResponse } from "@vercel/node";

// OpenSky Network — single global states/all call instead of tiled radius queries.
// Returns every currently tracked aircraft on Earth (~8,000–15,000 at any time).
const AUTH_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const STATES_URL = "https://opensky-network.org/api/states/all";

// Module-level token cache — reused across warm Vercel invocations
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing OPENSKY_CLIENT_ID or OPENSKY_CLIENT_SECRET");
  }

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in as number) * 1000 - 30_000;
  return cachedToken;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const token = await getAccessToken();

    const statesRes = await fetch(STATES_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!statesRes.ok) {
      return res.status(200).json({ ac: [] });
    }

    const data = await statesRes.json();

    // OpenSky state vector indices:
    // [0] icao24  [1] callsign  [2] origin_country  [3] time_position  [4] last_contact
    // [5] lon  [6] lat  [7] baro_altitude_m  [8] on_ground  [9] velocity_ms
    // [10] true_track  [11] vertical_rate  ...
    //
    // adsbService.normalizeAc expects alt_baro in feet and gs in knots,
    // so we convert from OpenSky's SI units here.
    const ac = (data.states as unknown[] ?? [])
      .filter((s: unknown) => {
        const v = s as unknown[];
        return !v[8] && v[5] != null && v[6] != null && v[7] != null;
      })
      .map((s: unknown) => {
        const v = s as unknown[];
        return {
          hex:      v[0] as string,
          flight:   ((v[1] as string | null) ?? "").trim(),
          r:        v[2] as string,
          lon:      v[5] as number,
          lat:      v[6] as number,
          alt_baro: (v[7] as number) / 0.3048,          // m → ft
          gs:       ((v[9] as number | null) ?? 0) / 0.5144, // m/s → knots
          track:    (v[10] as number | null) ?? 0,
        };
      });

    return res.status(200).json({ ac });
  } catch {
    return res.status(200).json({ ac: [] });
  }
}
