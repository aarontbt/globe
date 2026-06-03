import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-06-03; Brent $98.57 TradingView Jun 3; US strikes Qeshm Island; Iran hits Kuwait airport)
// Brent $98.57 (+4.3% from Jun 2; third consecutive up session); WTI $96.25 (+5.0%); Gold $4,490 est. (risk-off safe haven)
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 98.57,   change: +4.04,  changePct: +4.27, currency: "USD", unit: "/barrel", lastUpdated: "2026-06-03T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 96.25,   change: +4.58,  changePct: +5.00, currency: "USD", unit: "/barrel", lastUpdated: "2026-06-03T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4490.00, change: +7.10,  changePct: +0.16, currency: "USD", unit: "/oz",     lastUpdated: "2026-06-03T00:00:00Z" },
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
