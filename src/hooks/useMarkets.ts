import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-16 morning)
// Iran IRGC threatens Gulf-wide shipping; Pakistan army chief visits Tehran; WH optimistic. Brent $94.60 (TradingEconomics Apr 16), WTI $90.79 (TradingEconomics Apr 16), Gold ~$4,822 est. (safe-haven uptick on Iran Gulf threat).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 94.60,  change: -0.33, changePct: -0.35, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-16T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 90.79,  change: -0.49, changePct: -0.54, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-16T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4822.00, change: 102.00, changePct: 2.16, currency: "USD", unit: "/oz",    lastUpdated: "2026-04-16T00:00:00Z" },
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
