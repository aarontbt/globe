import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-06-17; Brent $79.45 TradingEconomics Jun 17; US-Iran MOU text agreed Jun 12; Trump announces deal Jun 14; signing Jun 19 Switzerland)
// Brent $79.45 (+0.6% from Jun 16; 3-month lows on deal expectations); WTI $75.47; Gold $4,333.20 (TradingEconomics Jun 17)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 79.45,   change: +0.47,  changePct: +0.60, currency: "USD", unit: "/barrel", lastUpdated: "2026-06-17T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 75.47,   change: -0.30,  changePct: -0.40, currency: "USD", unit: "/barrel", lastUpdated: "2026-06-17T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4333.20, change: +1.73,  changePct: +0.04, currency: "USD", unit: "/oz",     lastUpdated: "2026-06-17T00:00:00Z" },
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
