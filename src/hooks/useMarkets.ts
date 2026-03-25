import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-25 Asia open)
// Brent: AFP/BSS wire Mar 25 (~$98.30 Asia session after US peace plan + Iran partial Hormuz opening drove -5.5%). WTI: AFP/BSS wire Mar 25 ($87.72). Gold: Trading Economics Mar 24 close ($4,484, +1.72% confirmed).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 98.30,  change: -5.70,  changePct: -5.48, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-25T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 87.72,  change: -3.55,  changePct: -3.89, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-25T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4484.00, change: 57.00, changePct: 1.29,  currency: "USD", unit: "/oz",    lastUpdated: "2026-03-24T00:00:00Z" },
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
