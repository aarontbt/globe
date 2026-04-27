import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-27 morning; last trading day Apr 24)
// Araghchi Oman back-channel (Apr 26): FM visits Sultan Haitham, returns Islamabad, next Moscow; deal 'inches away'; Trump unharmed WHCD shooting (Apr 25, Cole Allen in custody); Brent ~$106 est. (+0.6%); WTI ~$95 est. (+0.6%); Gold ~$5,100 est.; tail risk 47%.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 106.00, change: 0.67,   changePct: 0.63,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-27T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 95.00,  change: 0.60,   changePct: 0.64,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-27T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5100.00, change: 0.00,   changePct: 0.00,  currency: "USD", unit: "/oz",     lastUpdated: "2026-04-27T00:00:00Z" },
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
