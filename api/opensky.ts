import type { VercelRequest, VercelResponse } from "@vercel/node";

const AUTH_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const TRACK_URL = "https://opensky-network.org/api/tracks/all";

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

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in as number) * 1000 - 30_000; // 30s buffer
  return cachedToken;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const icao24 = req.query.icao24 as string | undefined;
  if (!icao24) {
    return res.status(400).json({ error: "icao24 required", path: [] });
  }

  try {
    const token = await getAccessToken();

    const trackRes = await fetch(`${TRACK_URL}?icao24=${icao24}&time=0`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!trackRes.ok) {
      return res.status(200).json({ icao24, callsign: "", path: [] });
    }

    const data = await trackRes.json();

    // path entries: [unix_time, lat, lon, baro_alt_m, true_track_deg, on_ground]
    const path: [number, number, number][] = (data.path ?? [])
      .filter((p: unknown[]) => !p[5] && p[3] != null)
      .map((p: unknown[]) => [p[2] as number, p[1] as number, p[3] as number]);

    return res.status(200).json({
      icao24: data.icao24 ?? icao24,
      callsign: (data.callsign ?? "").trim(),
      path,
    });
  } catch {
    return res.status(200).json({ icao24, callsign: "", path: [] });
  }
}
