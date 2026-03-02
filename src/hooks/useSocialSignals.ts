import { useMemo } from "react";
import type { GlobeEvent } from "../types";
import { useGdeltEvents } from "./useGdeltEvents";
import { useRedditSignals } from "./useRedditSignals";
import { useBlueskySignals } from "./useBlueskySignals";

const TOP_N = 30;

export interface SocialStatus {
  gdelt:  { loading: boolean; error: string | null };
  reddit: { loading: boolean; error: string | null };
  bsky:   { loading: boolean; error: string | null };
}

interface Result {
  events: GlobeEvent[];
  status: SocialStatus;
}

// Normalized Levenshtein distance (0 = identical, 1 = completely different).
// Only compares the first 60 chars to keep it fast.
function titleDistance(a: string, b: string): number {
  const la = a.toLowerCase().slice(0, 60);
  const lb = b.toLowerCase().slice(0, 60);
  const m = la.length, n = lb.length;
  if (m === 0 || n === 0) return 1;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = la[i - 1] === lb[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n] / Math.max(m, n);
}

export function useSocialSignals(): Result {
  const gdelt  = useGdeltEvents();
  const reddit = useRedditSignals();
  const bsky   = useBlueskySignals();

  const events = useMemo<GlobeEvent[]>(() => {
    const all = [
      ...gdelt.events,
      ...reddit.events,
      ...bsky.events,
    ];

    // Deduplicate by title similarity — skip if Levenshtein distance < 0.3
    const deduped: GlobeEvent[] = [];
    for (const evt of all) {
      const isDup = deduped.some(
        existing => titleDistance(existing.title, evt.title) < 0.3
      );
      if (!isDup) deduped.push(evt);
    }

    return deduped
      .sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1))
      .slice(0, TOP_N);
  }, [gdelt.events, reddit.events, bsky.events]);

  const status: SocialStatus = {
    gdelt:  { loading: gdelt.loading,  error: gdelt.error },
    reddit: { loading: reddit.loading, error: reddit.error },
    bsky:   { loading: bsky.loading,   error: bsky.error },
  };

  return { events, status };
}
