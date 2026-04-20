import { useState, useEffect, useCallback, useRef } from "react";
import type { MarketQuote } from "../types";
import { fetchAllQuotes } from "../services/marketsService";

// Static fallback — reflects market brief snapshot (2026-04-21 morning)
// USS Spruance seizes Iranian Touska in Gulf of Oman (Apr 19); Iran vows retaliation, suspends Islamabad talks; ceasefire expires Apr 22 — extension 'highly unlikely' (Trump). Brent ~$99.50 est. (last confirmed $95.42 TradingEconomics Apr 20), WTI ~$94.70 est., Gold ~$5,000 est. (safe-haven surge on ceasefire expiry).
const FALLBACK_QUOTES: MarketQuote[] = [
  { symbol: "BZ=F", name: "Brent Crude", price: 99.50,  change: 3.50,  changePct: 3.65,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-21T00:00:00Z" },
  { symbol: "CL=F", name: "WTI Crude",   price: 94.70,  change: 3.20,  changePct: 3.50,  currency: "USD", unit: "/barrel", lastUpdated: "2026-04-21T00:00:00Z" },
  { symbol: "GC=F", name: "Gold",        price: 5000.00, change: 100.00, changePct: 2.04, currency: "USD", unit: "/oz",    lastUpdated: "2026-04-21T00:00:00Z" },
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
