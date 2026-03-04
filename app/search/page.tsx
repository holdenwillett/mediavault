"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MediaSearchItem, MediaSearchResponse } from "@/lib/media/types";

function mergeUnique(existing: MediaSearchItem[], incoming: MediaSearchItem[]) {
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];

  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

function MediaCard({ item }: { item: MediaSearchItem }) {
  const poster = item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : null;
  const mediaTypeLabel =
    item.mediaType === "tv" ? "TV" : item.mediaType.charAt(0).toUpperCase() + item.mediaType.slice(1);

  return (
    <Link href={`/${item.mediaType}/${item.externalId}`}>
      <div className="bg-gray-900 p-2 rounded hover:scale-105 transition cursor-pointer">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} className="rounded" alt={item.title} />
        ) : (
          <div className="aspect-[2/3] rounded bg-zinc-800 flex items-center justify-center text-gray-400 text-sm">
            No poster
          </div>
        )}

        <p className="mt-2 text-sm">{item.title}</p>

        <div className="mt-1 flex items-center justify-between gap-2">
          {typeof item.rating === "number" ? (
            <p className="text-xs text-gray-400">{"\u2b50"} {item.rating.toFixed(1)}</p>
          ) : (
            <span />
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 uppercase tracking-wide">
            {mediaTypeLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [top, setTop] = useState<MediaSearchItem[]>([]);
  const [related, setRelated] = useState<MediaSearchItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    const currentPage = page;
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    if (q.length < 2) {
      setTop([]);
      setRelated([]);
      setHasMore(false);
      setError(null);
      setLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}&page=${currentPage}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as MediaSearchResponse;

        if (!res.ok || data.error) {
          setTop([]);
          setRelated([]);
          setHasMore(false);
          setError(data.error || "Search failed");
          return;
        }

        const nextTop = data.top ?? [];
        const nextRelated = data.related ?? [];
        setHasMore(Boolean(data.hasMore));

        // Ignore stale responses from an older request.
        if (requestId !== requestIdRef.current) return;

        if (currentPage === 1) {
          setTop(nextTop);
          setRelated(nextRelated);
        } else {
          setTop((prev) => mergeUnique(prev, nextTop));
          setRelated((prev) => mergeUnique(prev, nextRelated));
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        const message = e instanceof Error ? e.message : "Network error";
        if (currentPage === 1) {
          setTop([]);
          setRelated([]);
          setHasMore(false);
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, page]);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Search Media</h1>
        <Link href="/" className="text-gray-300 hover:text-white">
          Home
        </Link>
      </div>

      <input
        className="w-full p-3 rounded mb-3 bg-zinc-900 text-white placeholder:text-zinc-400 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        placeholder="Search movies or TV..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="text-sm text-gray-400 mb-6">
        {query.trim().length < 2 && "Type at least 2 characters"}
        {loading && "Searching..."}
        {error && <span className="text-red-400">{error}</span>}
      </div>

      {top.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-3">Top matches</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            {top.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}

      {related.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mt-10 mb-3">Related</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            {related.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}

      {!error && query.trim().length >= 2 && (
        <div className="mt-8">
          <button
            type="button"
            className="px-4 py-2 rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            {loading && page > 1 ? "Loading..." : hasMore ? "Next page" : "No more results"}
          </button>
        </div>
      )}

      {!loading && !error && query.trim().length >= 2 && top.length === 0 && related.length === 0 && (
        <div className="text-gray-400">No results</div>
      )}
    </main>
  );
}
