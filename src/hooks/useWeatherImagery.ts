import { useEffect, useRef, useState } from "react";
import { validatePolarManifest, validateWeatherManifest, weatherFreshness } from "../domain/weather";
import type { WeatherFrame, WeatherHistoryFrame, WeatherManifest } from "../types/weather";

const EXTERNAL_MANIFEST_URL = import.meta.env.VITE_WEATHER_MANIFEST_URL;
const MANIFEST_URL = EXTERNAL_MANIFEST_URL || "/data/daily-snapshot/weather.json";
const POLL_MS = EXTERNAL_MANIFEST_URL ? 15 * 60_000 : 24 * 60 * 60_000;
type Actions = { select: (id: string | null) => void; toggle: () => void; retry: () => void; rate: (value: number) => void; window: (hours: number) => void };

export function useWeatherImagery(enabled: boolean) {
  const [frame, setFrame] = useState<WeatherFrame | null>(null);
  const [previousFrame, setPreviousFrame] = useState<WeatherFrame | null>(null);
  const [fadeReady, setFadeReady] = useState(true);
  const [latest, setLatest] = useState<WeatherManifest | null>(null);
  const [history, setHistory] = useState<WeatherHistoryFrame[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [historyHours, setHistoryHours] = useState(48);
  const [availableHours, setAvailableHours] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const actions = useRef<Actions | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let catalog: WeatherManifest | null = null;
    let current: WeatherFrame | null = null;
    let previous: WeatherFrame | null = null;
    let fadeTimer: number | undefined;
    let fadeRaf = 0;
    let rate = 1;
    let windowHours = 48;
    let selected: string | null = null;
    let isPlaying = false;
    let sourceBusy = false;
    let lastAttempt = 0;
    let generation = 0;
    let sourceRequest: AbortController | null = null;
    let imageRequest: AbortController | null = null;
    let playbackTimer: number | undefined;
    let sourceError: string | null = null;
    const release = (value: WeatherFrame | null) => {
      value?.patches.forEach(p => p.image.close());
      value?.polar?.patches.forEach(p => p.image.close());
    };
    const stop = () => { isPlaying = false; setPlaying(false); clearTimeout(playbackTimer); };
    const timeline = () => (catalog?.history ?? []).filter(f => Date.parse(f.observedAt) >= Date.parse(catalog!.observedAt) - windowHours * 3600_000);

    const scheduleNext = () => {
      clearTimeout(playbackTimer);
      if (!isPlaying || document.hidden || disposed || timeline().length < 2) return;
      playbackTimer = window.setTimeout(() => {
        const frames = timeline();
        if (frames.length < 2) { stop(); return; }
        const index = frames.findIndex(f => f.frameId === current?.manifest.frameId);
        const next = frames[(index + 1) % frames.length];
        selected = next.frameId === catalog?.frameId ? null : next.frameId;
        setSelectedId(selected);
        void loadFrame();
      }, 1200 / rate);
    };

    const loadFrame = async () => {
      if (!catalog || disposed || document.hidden) return;
      clearTimeout(playbackTimer);
      imageRequest?.abort();
      const request = new AbortController();
      imageRequest = request;
      const ownGeneration = ++generation;
      const target = selected ? timeline().find(f => f.frameId === selected) : null;
      const id = target?.frameId ?? catalog.frameId;
      if (current?.manifest.frameId === id) {
        setLoading(false);
        setError(sourceError);
        scheduleNext();
        return;
      }
      setLoading(true);
      const timeout = window.setTimeout(() => request.abort(), 60_000);
      const loaded: WeatherFrame["patches"] = [];
      const polarLoaded: WeatherFrame["patches"] = [];
      try {
        let manifest = catalog;
        if (target) {
          const response = await fetch(target.url, { signal: request.signal });
          if (!response.ok) throw new Error("Historical weather frame unavailable");
          manifest = validateWeatherManifest(await response.json(), response.url);
          if (manifest.frameId !== target.frameId || manifest.observedAt !== target.observedAt) {
            throw new Error("Historical weather frame does not match the timeline");
          }
        }
        // Only the requested frame is decoded. The prior complete frame stays
        // visible until every replacement sector is verified and decoded.
        const decode = async (patches: WeatherManifest["patches"], destination: WeatherFrame["patches"]) => {
        for (const patch of patches) {
          const response = await fetch(patch.url, { signal: request.signal });
          if (!response.ok) throw new Error("Weather image download failed");
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength !== patch.bytes) throw new Error("Incomplete weather image");
          const digest = await crypto.subtle.digest("SHA-256", buffer);
          const hash = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, "0")).join("");
          if (hash !== patch.sha256) throw new Error("Weather image checksum mismatch");
          const image = await createImageBitmap(new Blob([buffer], { type: "image/png" }), { premultiplyAlpha: "none" });
          if (image.width !== patch.width || image.height !== patch.height) {
            image.close();
            throw new Error("Invalid weather image dimensions");
          }
          destination.push({ patch, image });
          if (disposed || request.signal.aborted || generation !== ownGeneration) throw new Error("Weather request cancelled");
        }
        };
        await decode(manifest.patches, loaded);
        let polar: WeatherFrame["polar"];
        if (manifest.polarUrl) {
          const response = await fetch(manifest.polarUrl, { signal: request.signal });
          if (!response.ok) throw new Error("Polar cloud observations unavailable");
          const polarManifest = validatePolarManifest(await response.json(), response.url, manifest.observedAt);
          await decode(polarManifest.patches, polarLoaded);
          polar = { manifest: polarManifest, patches: polarLoaded };
        }
        clearTimeout(fadeTimer); cancelAnimationFrame(fadeRaf);
        release(previous);
        previous = current;
        current = { manifest, patches: loaded, polar };
        setPreviousFrame(previous);
        setFadeReady(!previous);
        setFrame(current);
        // Two paints give deck.gl the initial opacity before its uniform
        // transition starts; no React updates are needed per animation tick.
        if (previous) {
          fadeRaf = requestAnimationFrame(() => {
            fadeRaf = requestAnimationFrame(() => { if (!disposed) setFadeReady(true); });
          });
          fadeTimer = window.setTimeout(() => {
            release(previous); previous = null;
            if (!disposed) setPreviousFrame(null);
          }, 450);
        }
        setError(sourceError);
        scheduleNext();
      } catch (cause) {
        loaded.forEach(p => p.image.close());
        polarLoaded.forEach(p => p.image.close());
        if (!disposed && ownGeneration === generation && request.signal.reason !== "weather-tab-hidden") {
          stop();
          setError(cause instanceof Error ? cause.message : "Weather image unavailable");
        }
      } finally {
        clearTimeout(timeout);
        if (!disposed && ownGeneration === generation) setLoading(false);
      }
    };

    const refresh = async () => {
      if (document.hidden || disposed || sourceBusy) return;
      sourceBusy = true;
      lastAttempt = Date.now();
      if (!current) setLoading(true);
      const request = new AbortController();
      sourceRequest = request;
      const timeout = window.setTimeout(() => request.abort(), 30_000);
      try {
        const response = await fetch(MANIFEST_URL, { cache: "no-cache", signal: request.signal });
        if (!response.ok) throw new Error(`Weather source unavailable (${response.status})`);
        const manifest = validateWeatherManifest(await response.json(), response.url);
        if (catalog && Date.parse(manifest.observedAt) < Date.parse(catalog.observedAt)) {
          throw new Error("Weather source returned an older latest observation");
        }
        if (disposed || request.signal.aborted) return;
        catalog = manifest;
        sourceError = null;
        setLatest(manifest);
        setHistory(timeline());
        setAvailableHours((Date.parse(manifest.observedAt) - Date.parse(manifest.history?.[0]?.observedAt ?? manifest.observedAt)) / 3600_000);
        if (timeline().length < 2) stop();
        if (selected && !timeline().some(f => f.frameId === selected)) {
          stop(); selected = null; setSelectedId(null);
        }
        if (!isPlaying) await loadFrame();
      } catch (cause) {
        if (!disposed && request.signal.reason !== "weather-tab-hidden") {
          sourceError = cause instanceof Error ? cause.message : "Weather source unavailable";
          setError(sourceError);
          if (!current) setLoading(false);
        }
      } finally {
        clearTimeout(timeout);
        sourceBusy = false;
      }
    };

    actions.current = {
      select: id => {
        stop();
        selected = id === catalog?.frameId ? null : id;
        setSelectedId(selected);
        void loadFrame();
      },
      toggle: () => {
        if (isPlaying) { stop(); return; }
        if (timeline().length < 2) return;
        isPlaying = true; setPlaying(true);
        if (!selected) {
          selected = timeline()[0].frameId;
          setSelectedId(selected);
          void loadFrame();
        } else scheduleNext();
      },
      retry: () => { void refresh(); },
      rate: value => {
        if (![0.5, 1, 2, 4].includes(value)) return;
        rate = value; setPlaybackRate(value); scheduleNext();
      },
      window: hours => {
        if (![6, 24, 48, 72].includes(hours)) return;
        stop(); windowHours = hours; setHistoryHours(hours); setHistory(timeline());
        if (selected && !timeline().some(f => f.frameId === selected)) {
          selected = null; setSelectedId(null); void loadFrame();
        }
      },
    };
    const tick = () => {
      if (document.hidden) {
        stop();
        sourceRequest?.abort("weather-tab-hidden"); imageRequest?.abort("weather-tab-hidden");
        lastAttempt = 0;
        return;
      }
      setNow(Date.now());
      if (Date.now() - lastAttempt >= POLL_MS) void refresh();
    };
    void refresh();
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      disposed = true; actions.current = null;
      clearTimeout(playbackTimer); clearInterval(timer);
      clearTimeout(fadeTimer); cancelAnimationFrame(fadeRaf);
      sourceRequest?.abort(); imageRequest?.abort();
      document.removeEventListener("visibilitychange", tick);
      release(current); release(previous);
      setFrame(null); setLatest(null); setHistory([]); setSelectedId(null);
      setPreviousFrame(null); setFadeReady(true); setHistoryHours(48); setPlaybackRate(1); setAvailableHours(0);
      setPlaying(false); setLoading(false); setError(null);
    };
  }, [enabled]);

  return { frame: enabled ? frame : null, previousFrame: enabled ? previousFrame : null, fadeReady,
    loading, error, history, playing, selectedId, playbackRate, historyHours, availableHours,
    historical: Boolean(frame && latest && frame.manifest.frameId !== latest.frameId),
    selectFrame: (id: string | null) => actions.current?.select(id),
    togglePlayback: () => actions.current?.toggle(), retry: () => actions.current?.retry(),
    setPlaybackRate: (value: number) => actions.current?.rate(value),
    setHistoryHours: (hours: number) => actions.current?.window(hours),
    freshness: latest ? weatherFreshness(latest, now) : "unavailable" as const };
}
