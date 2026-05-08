import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-05-08 morning; Brent/WTI confirmed May 8 CNBC; Gold confirmed May 7 Fortune; TTF/JKM confirmed May 7 TradingEconomics carried)
// Brent $101.26 May 8 (+1.2%, CNBC; oil rallied on US-Iran fire exchange D66); WTI $95.64 (+0.9%); Gold $4,685.37 May 7 (-0.13%, Fortune; carried); US-Iran fire exchange May 7; MOU talks; tail 35%
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 101.26, change: +1.21,  changePct: +1.21, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-08T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 95.64,  change: +0.84,  changePct: +0.89, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-08T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4685.37, change: -6.11, changePct: -0.13, currency: "USD", unit: "/oz",     lastUpdated: "2026-05-07T00:00:00Z" },
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
