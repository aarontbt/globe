import { useState, useEffect, useRef } from "react";
import type { AISShip } from "../types";

const CACHE_KEY = "gb:aisShips";
const TTL_MS = 60_000; // refresh every 60s

interface CacheEntry {
  ships: AISShip[];
  fetchedAt: number;
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(ships: AISShip[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ships, fetchedAt: Date.now() }));
  } catch {}
}

/**
 * Fetches AIS ship positions from the server-side proxy.
 * aisstream.io blocks browser WebSocket connections (no CORS), so
 * the Vite dev plugin and Vercel serverless function connect server-side
 * and return collected ships as JSON via /api/aisstream.
 */
export function useAISShips(enabled: boolean) {
  const [ships, setShips] = useState<AISShip[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      setShips([]);
      return;
    }

    let cancelled = false;

    async function fetchShips() {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/aisstream", { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AISShip[];
        if (cancelled) return;
        if (data.length > 0) {
          writeCache(data);
          setShips(data);
        }
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        console.warn("[useAISShips] fetch failed:", e);
      }
      if (!cancelled) scheduleRefresh(TTL_MS);
    }

    function scheduleRefresh(delayMs: number) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        fetchShips();
      }, delayMs);
    }

    // Use cache if fresh, otherwise fetch immediately
    const cache = readCache();
    const now = Date.now();
    if (cache && now - cache.fetchedAt < TTL_MS) {
      setShips(cache.ships);
      scheduleRefresh(TTL_MS - (now - cache.fetchedAt));
    } else {
      fetchShips();
    }

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      abortRef.current = null;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled]);

  return { ships };
}
