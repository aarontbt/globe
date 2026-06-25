import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-06-26; Jun 25 close confirmed — roadmap agreed Jun 22-23 Switzerland; Goldman Q4 $80; mine-clearing Day 7 of 30)
// Brent $75.04 (TradingEconomics Jun 25, +1.76%); WTI $69.95 est. (below $70 Jun 25, CNBC); Gold $4,040.30 (TradingEconomics Jun 25, +1.02%)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 75.04,   change: 1.30,   changePct: 1.76,  currency: "USD", unit: "/barrel", lastUpdated: "2026-06-26T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 69.95,   change: -0.15,  changePct: -0.21, currency: "USD", unit: "/barrel", lastUpdated: "2026-06-26T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4040.30, change: 40.77,  changePct: 1.02,  currency: "USD", unit: "/oz",     lastUpdated: "2026-06-26T00:00:00Z" },
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
