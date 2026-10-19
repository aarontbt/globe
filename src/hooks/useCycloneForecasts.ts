import { useEffect, useMemo, useRef, useState } from "react";
import { cycloneFreshness, validateCycloneManifest } from "../domain/cyclone";
import type { CycloneManifest } from "../types/cyclone";

const EXTERNAL_URL = import.meta.env.VITE_CYCLONE_MANIFEST_URL;
const URL = EXTERNAL_URL || "/data/daily-snapshot/cyclones.json";
const POLL_MS = EXTERNAL_URL ? 15 * 60_000 : 24 * 60 * 60_000;
export function useCycloneForecasts(enabled: boolean) {
  const [manifest, setManifest] = useState<CycloneManifest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const previousRef = useRef<CycloneManifest | null>(null);
  const retryRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let disposed = false;
    let request: AbortController | null = null;
    const load = async () => {
      if (disposed || document.hidden) return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      setLoading(true);
      const timer = setTimeout(() => controller.abort(), 25_000);
      try {
        const response = await fetch(URL, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Forecast feed unavailable");
        const text = await response.text();
        if (text.length > 2 * 1024 * 1024) throw new Error("Forecast feed too large");
        const next = validateCycloneManifest(JSON.parse(text));
        if (disposed || request !== controller) return;
        const previous = previousRef.current;
        if (previous && (Date.parse(next.generatedAt) < Date.parse(previous.generatedAt) || next.storms.some(s => {
          const old = previous.storms.find(p => p.id === s.id);
          return old && Date.parse(s.issuedAt) < Date.parse(old.issuedAt);
        }))) throw new Error("Forecast feed rolled back");
        previousRef.current = next;
        setManifest(next);
        setNow(Date.now());
        setError(null);
      } catch {
        if (!disposed && request === controller && !document.hidden) setError("Forecast refresh failed. Previous advisories retain their original dates.");
      } finally {
        clearTimeout(timer);
        if (!disposed && request === controller) setLoading(false);
      }
    };
    const visibility = () => {
      if (document.hidden) { request?.abort(); setLoading(false); }
      else void load();
    };
    retryRef.current = () => void load();
    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 60_000);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      request?.abort();
      clearInterval(poll);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", visibility);
      retryRef.current = () => {};
    };
  }, [enabled]);
  const storms = useMemo(() => (manifest?.storms ?? []).filter(s => cycloneFreshness(s, now) !== "expired")
    .sort((a, b) => (a.agency === "JMA" ? 0 : 1) - (b.agency === "JMA" ? 0 : 1)), [manifest, now]);
  const selected = storms.find(s => s.id === selectedId) ?? storms[0] ?? null;
  return { manifest, storms, selected, select: setSelectedId, loading, error, now, retry: () => retryRef.current() };
}
export type CycloneForecastState = ReturnType<typeof useCycloneForecasts>;
