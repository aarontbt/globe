import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-05-29 morning; Brent confirmed CNBC May 29 close; WTI confirmed CNBC May 29 close; Gold confirmed Forbes/CNBC May 29)
// Brent $92.05 (-1.77%) May 29 close — worst month since 2020 (-19%); WTI $87.36 (-1.73%); Trump ends Situation Room meeting without 'final determination' on Iran deal
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 92.05,   change: -1.66,  changePct: -1.77, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-29T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 87.36,   change: -1.54,  changePct: -1.73, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-29T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4523.00, change: +43.10, changePct: +0.96, currency: "USD", unit: "/oz",     lastUpdated: "2026-05-29T00:00:00Z" },
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
