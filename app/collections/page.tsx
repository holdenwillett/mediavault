"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CollectionEntry, CollectionList, CollectionStatus } from "@/lib/account/types";
import type { MediaType } from "@/lib/media/types";

const STATUS_LABEL: Record<CollectionStatus, string> = {
  wishlist: "Wishlist",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_ORDER: CollectionStatus[] = ["wishlist", "in_progress", "completed"];
const MEDIA_FILTERS: Array<"all" | MediaType> = ["all", "movie", "tv", "game"];
type RatingSort = "recent" | "highest" | "lowest";

function isCollectionStatus(value: string): value is CollectionStatus {
  return value === "wishlist" || value === "in_progress" || value === "completed";
}

function formatRatingValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function mediaTypeLabel(type: MediaType): string {
  return type === "tv" ? "TV" : type.charAt(0).toUpperCase() + type.slice(1);
}

export default function CollectionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CollectionEntry[]>([]);
  const [lists, setLists] = useState<CollectionList[]>([]);
  const [selectedList, setSelectedList] = useState<string>("all");
  const [selectedMediaType, setSelectedMediaType] = useState<"all" | MediaType>("all");
  const [sortMode, setSortMode] = useState<RatingSort>("recent");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      setSessionExpired(false);
      try {
        const [res, listsRes] = await Promise.all([
          fetch("/api/collections", { cache: "no-store" }),
          fetch("/api/collections/lists", { cache: "no-store" }),
        ]);
        if (!active) return;
        if (res.status === 401 || listsRes.status === 401) {
          setSignedIn(false);
          setSessionExpired(true);
          setItems([]);
          setLists([]);
          setLoading(false);
          router.push("/account?next=/collections&reason=session-expired");
          return;
        }
        if (!res.ok || !listsRes.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const listsData = (await listsRes.json().catch(() => ({}))) as { error?: string };
          setSignedIn(false);
          setItems([]);
          setLists([]);
          setError(data.error ?? listsData.error ?? "Could not load your collection.");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { items?: CollectionEntry[] };
        const listsData = (await listsRes.json()) as { lists?: CollectionList[] };
        setSignedIn(true);
        setItems(data.items ?? []);
        setLists(listsData.lists ?? []);
        setLoading(false);
      } catch {
        if (!active) return;
        setSignedIn(false);
        setItems([]);
        setLists([]);
        setError("Network error while loading your collection.");
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  const filteredItems = useMemo(() => {
    const listFiltered =
      selectedList === "all"
        ? items
        : selectedList === "unlisted"
        ? items.filter((item) => !item.listId)
        : items.filter((item) => item.listId === selectedList);

    if (selectedMediaType === "all") return listFiltered;
    return listFiltered.filter((item) => item.mediaType === selectedMediaType);
  }, [items, selectedList, selectedMediaType]);

  const grouped = useMemo(() => {
    const byStatus: Record<CollectionStatus, CollectionEntry[]> = {
      wishlist: [],
      in_progress: [],
      completed: [],
    };
    const ratingValue = (item: CollectionEntry) => (typeof item.userRating === "number" ? item.userRating : item.rating ?? -1);
    const sorted = [...filteredItems].sort((a, b) => {
      if (sortMode === "highest") {
        const diff = ratingValue(b) - ratingValue(a);
        if (diff !== 0) return diff;
      } else if (sortMode === "lowest") {
        const diff = ratingValue(a) - ratingValue(b);
        if (diff !== 0) return diff;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    for (const item of sorted) {
      const status = isCollectionStatus(String(item.status)) ? item.status : "wishlist";
      byStatus[status].push(item);
    }
    return byStatus;
  }, [filteredItems, sortMode]);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Collection</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-300 hover:text-white">
            Home
          </Link>
          <Link href="/quick-add" className="text-gray-300 hover:text-white">
            Quick-Add
          </Link>
          <Link href="/search" className="text-gray-300 hover:text-white">
            Search
          </Link>
          <Link href="/account" className="text-gray-300 hover:text-white">
            Account
          </Link>
          <Link href="/profile" className="text-gray-300 hover:text-white">
            Profile
          </Link>
        </div>
      </div>

      {loading ? <p className="text-zinc-400">Loading...</p> : null}

      {!loading && error ? (
        <div className="rounded-lg border border-red-900/40 bg-red-950/30 p-4 mb-5">
          <p className="text-red-300">{error}</p>
        </div>
      ) : null}

      {!loading && !signedIn ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-zinc-300">
            {sessionExpired ? "Your session expired. Sign in again to view your collection." : "Sign in first to track a collection."}
          </p>
          <Link href="/account" className="text-white underline">
            Go to Account
          </Link>
        </div>
      ) : null}

      {!loading && signedIn ? (
        <>
          <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-sm border ${
                  selectedList === "all" ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"
                }`}
                onClick={() => setSelectedList("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-sm border ${
                  selectedList === "unlisted" ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"
                }`}
                onClick={() => setSelectedList("unlisted")}
              >
                Unlisted
              </button>
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  className={`px-3 py-1.5 rounded text-sm border ${
                    selectedList === list.id ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"
                  }`}
                  onClick={() => setSelectedList(list.id)}
                >
                  {list.name}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {MEDIA_FILTERS.map((mediaFilter) => (
                <button
                  key={mediaFilter}
                  type="button"
                  className={`px-3 py-1.5 rounded text-sm border ${
                    selectedMediaType === mediaFilter
                      ? "bg-white text-black border-white"
                      : "border-zinc-700 hover:bg-zinc-800"
                  }`}
                  onClick={() => setSelectedMediaType(mediaFilter)}
                >
                  {mediaFilter === "all" ? "All Types" : mediaTypeLabel(mediaFilter)}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-sm border ${
                  sortMode === "recent" ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"
                }`}
                onClick={() => setSortMode("recent")}
              >
                Recent
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-sm border ${
                  sortMode === "highest" ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"
                }`}
                onClick={() => setSortMode("highest")}
              >
                Highest Rated
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-sm border ${
                  sortMode === "lowest" ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"
                }`}
                onClick={() => setSortMode("lowest")}
              >
                Lowest Rated
              </button>
            </div>
          </section>

          {STATUS_ORDER.map((status) => (
            <section key={status} className="mt-8">
              <h2 className="text-xl font-semibold mb-3">{STATUS_LABEL[status]}</h2>
              {grouped[status].length === 0 ? (
                <p className="text-sm text-zinc-500">No items yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {grouped[status].map((item) => (
                    <Link key={item.id} href={`/${item.mediaType}/${item.externalId}`} className="group block">
                      <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                        <div className="relative aspect-[2/3] overflow-hidden bg-zinc-950">
                          {item.posterUrl ? (
                            item.mediaType === "game" ? (
                              <div className="relative h-full w-full bg-zinc-950">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.posterUrl}
                                  className="absolute inset-0 h-full w-full object-cover scale-125 opacity-45 transition-transform duration-300 group-hover:scale-[1.3]"
                                  alt=""
                                  aria-hidden="true"
                                />
                                <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.posterUrl}
                                  alt={item.title}
                                  className="relative h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.posterUrl}
                                alt={item.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            )
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500 px-2 text-center">
                              No Poster
                            </div>
                          )}
                          <span className="absolute right-2 top-2 text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 bg-black/70 text-zinc-200 uppercase tracking-wide">
                            {mediaTypeLabel(item.mediaType)}
                          </span>
                        </div>
                        <div className="bg-zinc-900 p-2.5">
                          <p className="text-xs text-zinc-100 truncate">{item.title}</p>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                            <p className="text-zinc-300">
                              You:{" "}
                              {typeof item.userRating === "number"
                                ? `${formatRatingValue(item.userRating)}/10 ⭐`
                                : "-"}
                            </p>
                            <p className="text-zinc-500">
                              {typeof item.rating === "number" ? `${formatRatingValue(item.rating)}/10` : "-"}
                            </p>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      ) : null}
    </main>
  );
}
