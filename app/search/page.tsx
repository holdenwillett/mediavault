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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setTop([]);
      setRelated([]);
      setError(null);
      setLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();

        if (!res.ok || data?.error) {
          setTop([]);
          setRelated([]);
          setError(data?.error || "Search failed");
          return;
        }

        setTop(data.top ?? []);
        setRelated(data.related ?? []);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Network error";
        setTop([]);
        setRelated([]);
        setError(message);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

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

      {!loading && !error && query.trim().length >= 2 && top.length === 0 && related.length === 0 && (
        <div className="text-gray-400">No results</div>
      )}
    </main>
  );
}
