import type { VercelRequest, VercelResponse } from "@vercel/node";

const UPSTREAM = "https://api.typesafe.ai/v1/systemone";
const MAX_BODY_BYTES = 120_000;

function isEnabled(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY) && process.env.TYPESAFE_ENABLED !== "false";
}

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    sendJson(res, 200, { enabled: isEnabled() });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!isEnabled()) {
    res.status(204).end();
    return;
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendJson(res, 400, { error: "A JSON object body is required" });
    return;
  }

  const payload = {
    state: (body as Record<string, unknown>).state,
    model: (body as Record<string, unknown>).model ?? "jev-latest",
    questions: (body as Record<string, unknown>).questions,
  };

  if (payload.state === undefined || !payload.questions || typeof payload.questions !== "object") {
    sendJson(res, 400, { error: "state and questions are required" });
    return;
  }

  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) {
    sendJson(res, 413, { error: "TypeSafe request is too large" });
    return;
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: serialized,
      signal: AbortSignal.timeout(15_000),
    });

    const responseBody = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(responseBody);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 502, { error: "TypeSafe upstream request failed", detail: message });
  }
}
