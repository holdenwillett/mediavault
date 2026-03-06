"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MediaSearchItem, MediaSearchResponse, MediaType } from "@/lib/media/types";

type SearchFilter = "all" | MediaType;
const FILTERS: SearchFilter[] = ["all", "movie", "tv", "game"];

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

function rankForDisplay(item: MediaSearchItem, qLower: string): number {
  const title = item.title.toLowerCase();
  const popularity = item.popularity ?? 0;
  const voteCount = item.voteCount ?? 0;
  const rating = item.rating ?? 0;

  let s = 0;
  if (title === qLower) s += 1200;
  else if (title.startsWith(qLower)) s += 800;
  else if (title.includes(qLower)) s += 500;

  s += rating * 65;
  s += Math.log10(voteCount + 1) * 240;
  s += Math.log10(popularity + 1) * 70;
  return s;
}

function emptyResponse(page: number): MediaSearchResponse {
  return { top: [], related: [], page, hasMore: false };
}

function MediaCard({ item }: { item: MediaSearchItem }) {
  const poster = item.posterUrl ?? null;
  const mediaTypeLabel =
    item.mediaType === "tv" ? "TV" : item.mediaType.charAt(0).toUpperCase() + item.mediaType.slice(1);

  return (
    <Link href={`/${item.mediaType}/${item.externalId}`}>
      <div className="bg-gray-900 p-2 rounded hover:scale-105 transition cursor-pointer">
        {poster ? (
          <div className="aspect-[2/3] rounded overflow-hidden bg-zinc-800">
            {item.mediaType === "game" ? (
              <div className="relative w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={poster}
                  className="absolute inset-0 w-full h-full object-cover scale-125 opacity-45"
                  alt=""
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poster} className="relative w-full h-full object-contain p-1.5" alt={item.title} />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} className="w-full h-full object-cover" alt={item.title} />
            )}
          </div>
        ) : (
          <div className="aspect-[2/3] rounded bg-zinc-800 flex items-center justify-center text-gray-400 text-sm">
            No poster
          </div>
        )}

        <p className="mt-2 text-sm">{item.title}</p>

        <div className="mt-1 flex items-center justify-between gap-2">
          {typeof item.rating === "number" ? (
            <p className="text-xs text-gray-400">{"\u2b50"} {item.rating.toFixed(1)}/10</p>
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
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [top, setTop] = useState<MediaSearchItem[]>([]);
  const [related, setRelated] = useState<MediaSearchItem[]>([]);
  const [recommendations, setRecommendations] = useState<MediaSearchItem[]>([]);
  const [recommendationSeeds, setRecommendationSeeds] = useState<string[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsLoaded, setRecommendationsLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const recommendationGroups = useMemo(() => {
    return {
      movie: recommendations.filter((item) => item.mediaType === "movie"),
      tv: recommendations.filter((item) => item.mediaType === "tv"),
      game: recommendations.filter((item) => item.mediaType === "game"),
    };
  }, [recommendations]);

  useEffect(() => {
    if (query.trim().length >= 2 || recommendationsLoaded) return;

    const controller = new AbortController();
    (async () => {
      try {
        setRecommendationsLoading(true);
        const res = await fetch("/api/recommendations", { cache: "no-store", signal: controller.signal });
        if (!res.ok) {
          setRecommendations([]);
          setRecommendationSeeds([]);
          setRecommendationsLoaded(true);
          return;
        }
        const data = (await res.json()) as { items?: MediaSearchItem[]; basedOn?: string[] };
        setRecommendations(data.items ?? []);
        setRecommendationSeeds(data.basedOn ?? []);
        setRecommendationsLoaded(true);
      } catch {
        if (!controller.signal.aborted) {
          setRecommendations([]);
          setRecommendationSeeds([]);
          setRecommendationsLoaded(true);
        }
      } finally {
        if (!controller.signal.aborted) setRecommendationsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [query, recommendationsLoaded]);

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

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

        const requests: Array<Promise<Response>> = [];
        const sourceKeys: Array<"tmdb" | "games"> = [];

        if (filter === "all" || filter === "movie" || filter === "tv") {
          sourceKeys.push("tmdb");
          requests.push(
            fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}&page=${currentPage}`, {
              signal: controller.signal,
            })
          );
        }
        if (filter === "all" || filter === "game") {
          sourceKeys.push("games");
          requests.push(
            fetch(`/api/games/search?q=${encodeURIComponent(q)}&page=${currentPage}`, {
              signal: controller.signal,
            })
          );
        }
        const responses = await Promise.all(requests);
        const payloads = (await Promise.all(responses.map((r) => r.json()))) as MediaSearchResponse[];

        const bySource: Record<"tmdb" | "games", MediaSearchResponse> = {
          tmdb: emptyResponse(currentPage),
          games: emptyResponse(currentPage),
        };
        sourceKeys.forEach((key, i) => {
          bySource[key] = payloads[i];
        });

        const tmdbData = bySource.tmdb;
        const gamesData = bySource.games;
        const allFailed = responses.length > 0 && responses.every((r) => !r.ok);
        const allErrored = Boolean(tmdbData.error && gamesData.error);

        if (allFailed || allErrored) {
          setTop([]);
          setRelated([]);
          setHasMore(false);
          setError(tmdbData.error || gamesData.error || "Search failed");
          return;
        }

        const qLower = q.toLowerCase();
        const rawTop = mergeUnique(tmdbData.top ?? [], gamesData.top ?? []);
        const rawRelated = mergeUnique(tmdbData.related ?? [], gamesData.related ?? []);

        const filteredTop = filter === "all" ? rawTop : rawTop.filter((item) => item.mediaType === filter);
        const filteredRelated =
          filter === "all" ? rawRelated : rawRelated.filter((item) => item.mediaType === filter);

        const nextTop = filteredTop.sort((a, b) => rankForDisplay(b, qLower) - rankForDisplay(a, qLower));
        const nextRelated = filteredRelated.sort((a, b) => rankForDisplay(b, qLower) - rankForDisplay(a, qLower));
        setHasMore(Boolean(tmdbData.hasMore || gamesData.hasMore));

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
  }, [query, page, filter]);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Search Media</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-300 hover:text-white">
            Home
          </Link>
          <Link href="/quick-add" className="text-gray-300 hover:text-white">
            Quick-Add
          </Link>
          <Link href="/account" className="text-gray-300 hover:text-white">
            Account
          </Link>
          <Link href="/collections" className="text-gray-300 hover:text-white">
            Collections
          </Link>
          <Link href="/profile" className="text-gray-300 hover:text-white">
            Profile
          </Link>
        </div>
      </div>

      <input
        className="w-full p-3 rounded mb-3 bg-zinc-900 text-white placeholder:text-zinc-400 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        placeholder="Search movies, TV, or games..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const label = f === "all" ? "All" : f === "tv" ? "TV" : f.charAt(0).toUpperCase() + f.slice(1);
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              className={`px-3 py-1 rounded-full text-sm border ${
                active
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800"
              }`}
              onClick={() => setFilter(f)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="text-sm text-gray-400 mb-6">
        {query.trim().length < 2 && "Type at least 2 characters"}
        {loading && "Searching..."}
        {error && <span className="text-red-400">{error}</span>}
      </div>

      {query.trim().length < 2 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Recommended For You</h2>
          {recommendationSeeds.length > 0 && (
            <p className="text-sm text-zinc-400 mb-3">Based on: {recommendationSeeds.join(", ")}</p>
          )}
          {recommendationsLoading && <p className="text-sm text-zinc-500">Loading recommendations...</p>}
          {!recommendationsLoading && recommendations.length > 0 && (
            <div className="space-y-8">
              {recommendationGroups.movie.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Movies</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                    {recommendationGroups.movie.map((item) => (
                      <MediaCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {recommendationGroups.tv.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">TV</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                    {recommendationGroups.tv.map((item) => (
                      <MediaCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {recommendationGroups.game.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Games</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                    {recommendationGroups.game.map((item) => (
                      <MediaCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!recommendationsLoading && recommendationsLoaded && recommendations.length === 0 && (
            <p className="text-sm text-zinc-500">
              Add a few titles to your collection to unlock personalized recommendations.
            </p>
          )}
        </section>
      )}

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
