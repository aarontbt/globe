import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-26 morning; last trading day Apr 24)
// Talks collapse: Iran FM Araghchi departs Pakistan (Apr 25); Trump tells Witkoff/Kushner not to travel; Trump 'shoot and kill' ROE for IRGC minelaying boats (Apr 23); Brent $105.33 confirmed (+1.6% Apr 24 close, TradingEconomics/CNBC); WTI $94.40 confirmed (CNBC Apr 24); Gold ~$5,100 est.; tail risk 50%.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 105.33, change: 1.66,   changePct: 1.60,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-26T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 94.40,  change: -0.96,  changePct: -1.01, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-26T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5100.00, change: 50.00,  changePct: 0.99, currency: "USD", unit: "/oz",     lastUpdated: "2026-04-26T00:00:00Z" },
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
