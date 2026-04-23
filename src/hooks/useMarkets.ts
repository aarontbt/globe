import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-23 morning)
// IRGC seizes MSC Francesca + Epaminondas in Hormuz (Apr 22); ceasefire extension kinetically challenged; Brent confirmed $101.73 (+3.3% Apr 22 close, TradingEconomics/Fortune); D52 Brent ~$102.50 est. (+0.8%); WTI ~$97.50 est.; Gold ~$5,050 est. (safe-haven bid on ship seizures); tail risk 40%.
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 102.50, change: 0.77,   changePct: 0.76,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-23T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 97.50,  change: 1.00,   changePct: 1.03,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-23T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5050.00, change: 150.00, changePct: 3.06, currency: "USD", unit: "/oz",     lastUpdated: "2026-04-23T00:00:00Z" },
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
