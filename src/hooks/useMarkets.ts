import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-03-18 Asia morning)
// Brent: oilprice.com delayed quote Mar 18. WTI: oilprice.com delayed quote Mar 18. Gold: carried from Mar 17 — no confirmed Mar 18 source.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 102.52, change: -0.90,  changePct: -0.87, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-18T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 94.87,  change: -1.34,  changePct: -1.39, currency: "USD", unit: "/barrel", lastUpdated: "2026-03-18T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5012.70, change: 7.16,  changePct: 0.14,  currency: "USD", unit: "/oz",     lastUpdated: "2026-03-17T00:00:00Z" },
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
