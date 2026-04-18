import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-17 morning)
// Iran FM Araghchi declares Hormuz "completely open"; US blockade persists vessel-scoped; $20B frozen-assets deal under negotiation. Brent $91.87 (TradingEconomics Apr 17 confirmed), WTI ~$88.16 est., Gold ~$4,790 est. (de-escalation unwind).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 91.87,  change: -2.73, changePct: -2.89, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-17T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 88.16,  change: -2.63, changePct: -2.90, currency: "USD", unit: "/barrel", lastUpdated: "2026-04-17T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 4790.00, change: -32.00, changePct: -0.66, currency: "USD", unit: "/oz",    lastUpdated: "2026-04-17T00:00:00Z" },
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
