import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects sourced market snapshot (2026-04-03 morning)
// Brent: $109.03 confirmed (Gulf News/CNBC Apr 3 07:17 JST, +8.3% on Trump 'Stone Ages' escalation reversal). WTI: ~$111 confirmed (OilPriceAPI NYMEX live 03:04 UTC Apr 3). Gold: $4,675 confirmed (Fortune Apr 2 10:25am ET).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 109.03, change: 8.39,   changePct: 8.34,   currency: "USD", unit: "/barrel", lastUpdated: "2026-04-03T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 111.00, change: 12.96,  changePct: 13.22,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-03T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4675.00, change: 20.50, changePct: 0.44,   currency: "USD", unit: "/oz",    lastUpdated: "2026-04-03T00:00:00Z" },
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
