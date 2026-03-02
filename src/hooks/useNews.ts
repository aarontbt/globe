import { useState, useEffect } from "react";
import type { NewsArticle } from "../types";
import { fetchAllFeeds, STATIC_FALLBACK_ARTICLES } from "../services/newsService";

const CACHE_KEY = "news_cache";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface NewsCache {
  articles: NewsArticle[];
  timestamp: number;
}

function readCache(): NewsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NewsCache;
  } catch {
    return null;
  }
}

function writeCache(articles: NewsArticle[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ articles, timestamp: Date.now() }));
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded)
  }
}

interface UseNewsResult {
  articles: NewsArticle[];
  loading: boolean;
  cacheAge: number | null; // ms since last fetch, null if live data
  refresh: () => Promise<boolean>; // clears cache, fetches fresh; returns true on success
}

async function doFetch(
  setArticles: (a: NewsArticle[]) => void,
  setCacheAge: (n: number | null) => void,
  setLoading: (b: boolean) => void,
  ignoreCachedFallback = false,
): Promise<boolean> {
  setLoading(true);
  const cached = readCache();
  try {
    const data = await fetchAllFeeds();
    if (data.length > 0) {
      setArticles(data);
      setCacheAge(null);
      writeCache(data);
      return true;
    } else if (!ignoreCachedFallback && cached) {
      setArticles(cached.articles);
      setCacheAge(Date.now() - cached.timestamp);
    }
    return false;
  } catch {
    if (!ignoreCachedFallback && cached) {
      setArticles(cached.articles);
      setCacheAge(Date.now() - cached.timestamp);
    }
    return false;
  } finally {
    setLoading(false);
  }
}

export function useNews(): UseNewsResult {
  const [articles, setArticles] = useState<NewsArticle[]>(STATIC_FALLBACK_ARTICLES);
  const [loading, setLoading] = useState(true);
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  useEffect(() => {
    const cached = readCache();
    const age = cached ? Date.now() - cached.timestamp : Infinity;

    if (cached && age < CACHE_TTL_MS) {
      // Cache is fresh — use it, skip network
      setArticles(cached.articles);
      setCacheAge(age);
      setLoading(false);
      return;
    }

    doFetch(setArticles, setCacheAge, setLoading);
  }, []);

  const refresh = async (): Promise<boolean> => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch { /* ignore */ }
    return doFetch(setArticles, setCacheAge, setLoading, true);
  };

  return { articles, loading, cacheAge, refresh };
}
