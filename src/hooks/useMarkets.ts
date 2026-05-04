import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-05-04 morning; last confirmed May 4)
// Brent $108.12 May 4 (0.0%, TradingEconomics; flat vs May 1 $108.10); TTF €45.08 May 4 (-2.3%, TradingEconomics); WTI ~$101.88 est. May 4; Gold $4,621.69 est. (CORRECTED from prior over-estimate ~$5,210; confirmed search data May 1 $4,612.50); Project Freedom launched (US Navy guides ships through Hormuz); tail 45%.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 108.12, change: +0.02,  changePct: +0.02, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-04T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 101.88, change: -1.02,  changePct: -0.99, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-04T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4621.69, change: +9.19,  changePct: +0.20, currency: "USD", unit: "/oz",     lastUpdated: "2026-05-04T00:00:00Z" },
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
