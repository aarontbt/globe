import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-26 Asia open)
// Brent: est. ~$101 (Bloomberg "Oil Rises as US and Iran Differ" Mar 26; WTI $90.26 confirmed + ~$10.74 spread). WTI: confirmed current price Mar 26 (web search). Gold: LiteFinance live price confirmed Mar 26 ($4,531).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 101.00, change: 2.70,  changePct: 2.74,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-26T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 90.26,  change: 2.54,  changePct: 2.90,  currency: "USD", unit: "/barrel", lastUpdated: "2026-03-26T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4531.00, change: 47.00, changePct: 1.05,  currency: "USD", unit: "/oz",    lastUpdated: "2026-03-26T00:00:00Z" },
];

interface UseMarketsResult {
  quotes: MarketQuote[];
  loading: boolean;
  lastUpdated: Date | null;
}

export function useMarkets(): UseMarketsResult {
  const [quotes, setQuotes] = useState<MarketQuote[]>(FALLBACK_QUOTES);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const stopped = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (stopped.current) return;
    try {
      const data = await fetchAllQuotes();
      if (data.length > 0) {
        setQuotes(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        stopped.current = true; // rate-limited — stop permanently
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 60_000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return { quotes, loading, lastUpdated };
}
