"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Media = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type: "movie" | "tv";
  vote_average?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
};

function mergeUnique(existing: Media[], incoming: Media[]) {
  const seen = new Set(existing.map((item) => `${item.media_type}:${item.id}`));
  const merged = [...existing];

  for (const item of incoming) {
    const key = `${item.media_type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function MediaCard({ item }: { item: Media }) {
  const title = item.title || item.name || "Untitled";
  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : null;

  return (
    <Link href={`/${item.media_type}/${item.id}`}>
      <div className="bg-gray-900 p-2 rounded hover:scale-105 transition cursor-pointer">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} className="rounded" alt={title} />
        ) : (
          <div className="aspect-[2/3] rounded bg-zinc-800 flex items-center justify-center text-gray-400 text-sm">
            No poster
          </div>
        )}

        <p className="mt-2 text-sm">{title}</p>

        {typeof item.vote_average === "number" && (
          <p className="text-xs text-gray-400">⭐ {item.vote_average.toFixed(1)}</p>
        )}
      </div>
    </Link>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [top, setTop] = useState<Media[]>([]);
  const [related, setRelated] = useState<Media[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    const q = query.trim();

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

        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}&page=${page}`);
        const data = await res.json();

        if (!res.ok || data?.error) {
          setTop([]);
          setRelated([]);
          setHasMore(false);
          setError(data?.error || "Search failed");
          return;
        }

        const nextTop = (data.top ?? []) as Media[];
        const nextRelated = (data.related ?? []) as Media[];
        setHasMore(Boolean(data?.hasMore));

        if (page === 1) {
          setTop(nextTop);
          setRelated(nextRelated);
        } else {
          setTop((prev) => mergeUnique(prev, nextTop));
          setRelated((prev) => mergeUnique(prev, nextRelated));
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Network error";
        if (page === 1) {
          setTop([]);
          setRelated([]);
          setHasMore(false);
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
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
        {loading && "Searching…"}
        {error && <span className="text-red-400">{error}</span>}
      </div>

      {top.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-3">Top matches</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            {top.map((item) => (
              <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
            ))}
          </div>
        </>
      )}

      {related.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mt-10 mb-3">Related</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            {related.map((item) => (
              <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
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
