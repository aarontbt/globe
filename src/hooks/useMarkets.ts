import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-05-28 morning; Brent confirmed CNBC May 27 close; WTI confirmed CNBC May 27 close; Gold confirmed CNBC May 27 close)
// Brent $94.29 May 27 close (CNBC -5%; Rubio 'every chance to succeed'; White House: MOU claim 'fabrication'); WTI $88.68 (-5%); tail 28%
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 94.29,   change: -3.92,  changePct: -4.00, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-28T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 88.68,   change: -3.90,  changePct: -4.21, currency: "USD", unit: "/barrel", lastUpdated: "2026-05-28T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4481.50, change: -49.11, changePct: -1.08, currency: "USD", unit: "/oz",     lastUpdated: "2026-05-28T00:00:00Z" },
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
