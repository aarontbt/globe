import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-28 morning; last confirmed Apr 27)
// Brent confirmed $108.11 Apr 27 (TradingEconomics, +2.64%); Iran Hormuz proposal (Apr 27): reopen if US lifts blockade + ends war; nuclear deferred; Rubio rejects - nuclear must be in deal (CNBC); Araghchi-Putin St. Petersburg; Brent ~$102 est. Apr 28 (-3.8%); WTI ~$91.50 est.; tail risk 45%.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 102.00, change: -4.11,  changePct: -3.87, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-28T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 91.50,  change: -3.50,  changePct: -3.68, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-28T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5150.00, change: 50.00,  changePct: 0.98,  currency: "USD", unit: "/oz",     lastUpdated: "2026-04-28T00:00:00Z" },
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
