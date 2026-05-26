import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-05-26 morning; Brent confirmed TradingEconomics May 26; WTI confirmed TradingEconomics May 26; Gold confirmed TradingEconomics May 26)
// Brent $98.21 May 26 confirmed (+0.99%, TradingEconomics); WTI $92.58 confirmed (+1.74%, TradingEconomics); Gold $4,530.61 May 26 confirmed (-0.85%, TradingEconomics); Trump "largely negotiated" deal (May 23); tail 23%
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 98.21,   change: +0.97,  changePct: +0.99, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-26T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 92.58,   change: +1.59,  changePct: +1.74, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-26T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4530.61, change: -38.63, changePct: -0.85, currency: "USD", unit: "/oz",     lastUpdated: "2026-05-26T00:00:00Z" },
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
