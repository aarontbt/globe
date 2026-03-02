import type { GlobeEvent } from "../types";
import { inferGeo, jitterCoords } from "../utils/geoInfer";

export const BSKY_JETSTREAM_URL =
  "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

// Keywords to filter posts — ASEAN + Middle East + financial
const KEYWORDS = [
  "iran", "hormuz", "oil", "asean", "war", "sanctions", "crude",
  "south china sea", "houthi", "taiwan strait", "philippines", "myanmar",
  "israel", "gaza", "ukraine", "tanker",
];

const MAX_EVENTS_PER_HOUR = 20;

export interface BskyRawPost {
  text: string;
  createdAt: string;
  langs?: string[];
}

export interface BskyMessage {
  did: string;
  time_us?: number;
  kind?: string;
  commit?: {
    operation: string;
    collection: string;
    record?: BskyRawPost;
  };
}

let _eventCounter = 0;
let _hourStart = Date.now();

export function resetRateLimit(): void {
  _eventCounter = 0;
  _hourStart = Date.now();
}

export function isRateLimited(): boolean {
  const now = Date.now();
  if (now - _hourStart >= 60 * 60 * 1000) {
    _eventCounter = 0;
    _hourStart = now;
  }
  return _eventCounter >= MAX_EVENTS_PER_HOUR;
}

export function hasSignalKeyword(text: string): boolean {
  const t = text.toLowerCase();
  return KEYWORDS.some(kw => t.includes(kw));
}

export function parseJetstreamMessage(raw: string): GlobeEvent | null {
  try {
    const msg: BskyMessage = JSON.parse(raw);
    if (
      msg.kind !== "commit" ||
      msg.commit?.operation !== "create" ||
      msg.commit?.collection !== "app.bsky.feed.post" ||
      !msg.commit?.record
    ) {
      return null;
    }

    const record = msg.commit.record;
    const text = record.text ?? "";
    if (!hasSignalKeyword(text)) return null;

    // Only process English-ish posts (or posts with no lang tag)
    const langs = record.langs ?? [];
    if (langs.length > 0 && !langs.some(l => l.startsWith("en"))) return null;

    const geo = inferGeo(text);
    if (!geo) return null;

    if (isRateLimited()) return null;
    _eventCounter++;

    const idx = _eventCounter;
    const postUrl = `https://bsky.app/profile/${msg.did}`;

    return {
      id: `bsky-${msg.did.slice(-8)}-${Date.now()}-${idx}`,
      title: text.length > 80 ? `${text.slice(0, 77)}…` : text,
      description: text,
      // Streaming posts carry no engagement data — category and signal are unknown
      category: "social",
      country: geo.country,
      region: geo.region,
      coordinates: jitterCoords(geo.coordinates, idx),
      impact: "medium",
      date: new Date(record.createdAt).toISOString().slice(0, 10),
      tags: ["bluesky", "social", geo.country.toLowerCase().replace(/\s+/g, "")],
      social: {
        platform: "bluesky",
        url: postUrl,
        engagement: 1,
        engagementLabel: "reposts",
      },
    };
  } catch {
    return null;
  }
}
