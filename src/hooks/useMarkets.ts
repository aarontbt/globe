import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-20 morning)
// Iran re-closes Hormuz (Apr 18-19) after US refuses to lift blockade; IRGC strikes vessels; Iran rejects Islamabad talks (Apr 19); ceasefire expires Apr 22. Brent ~$96 est. (CNN ~$95.71 Apr 19-20, re-escalation), WTI ~$91.50 est., Gold ~$4,900 est. (risk-off).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 96.00,  change: 4.13,  changePct: 4.49,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-20T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 91.50,  change: 3.34,  changePct: 3.79,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-20T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4900.00, change: 110.00, changePct: 2.30, currency: "USD", unit: "/oz",    lastUpdated: "2026-04-20T00:00:00Z" },
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
