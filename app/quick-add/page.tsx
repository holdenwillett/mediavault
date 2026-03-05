"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { MediaSearchItem, MediaType } from "@/lib/media/types";

const STAR_COUNT = 10;
const TYPE_OPTIONS: Array<{ value: MediaType; label: string }> = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "game", label: "Games" },
];

function mediaTypeLabel(type: MediaType): string {
  return type === "tv" ? "TV" : type.charAt(0).toUpperCase() + type.slice(1);
}

function shuffleItems<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function QuickAddPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<MediaType | null>(null);
  const [items, setItems] = useState<MediaSearchItem[]>([]);
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const current = items[index] ?? null;

  const loadItems = async (type: MediaType, nextPage: number, append: boolean) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/quick-add?type=${type}&page=${nextPage}`, { cache: "no-store" });
    if (requestId !== requestIdRef.current) return false;
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not load items.");
      setLoading(false);
      return false;
    }
    const data = (await res.json()) as { items?: MediaSearchItem[]; hasMore?: boolean; page?: number };
    if (requestId !== requestIdRef.current) return false;
    const nextItems = shuffleItems(data.items ?? []);
    setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
    setHasMore(Boolean(data.hasMore));
    setPage(nextPage);
    setLoading(false);
    return true;
  };

  const getStarValue = (starIndex: number, clientX: number, rect: DOMRect) => {
    const isLeftHalf = clientX - rect.left < rect.width / 2;
    return starIndex + (isLeftHalf ? 0.5 : 1);
  };

  const moveToNext = async () => {
    setShowRating(false);
    setHoverRating(null);

    if (index < items.length - 1) {
      setIndex((v) => v + 1);
      return;
    }

    if (!selectedType || !hasMore || loading) return;
    const ok = await loadItems(selectedType, page + 1, true);
    if (ok) setIndex((v) => v + 1);
  };

  const saveRating = async (value: number) => {
    if (!current) return;
    setSaving(true);
    setError(null);

    const saveRes = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType: current.mediaType,
        externalId: current.externalId,
        source: current.source,
        title: current.title,
        posterUrl: current.posterUrl,
        rating: current.rating,
        userRating: value,
        status: "completed",
        listId: null,
      }),
    });

    if (saveRes.status === 401) {
      setSaving(false);
      router.push("/account?next=/quick-add&reason=session-expired");
      return;
    }

    if (!saveRes.ok) {
      const data = (await saveRes.json().catch(() => ({}))) as { error?: string };
      setSaving(false);
      setError(data.error ?? "Could not save rating.");
      return;
    }

    setItems((prev) => prev.filter((_, i) => i !== index));
    setShowRating(false);
    setHoverRating(null);
    if (index >= items.length - 1) setIndex((v) => Math.max(0, v - 1));
    setSaving(false);
  };

  const displayRating = hoverRating ?? 0;
  const promptLabel = useMemo(() => {
    if (!selectedType) return "Choose a media type to start quick-adding.";
    return `Showing ${mediaTypeLabel(selectedType)} picks one-by-one.`;
  }, [selectedType]);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Quick-Add</h1>
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
          <Link href="/collections" className="text-gray-300 hover:text-white">
            Collections
          </Link>
          <Link href="/profile" className="text-gray-300 hover:text-white">
            Profile
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-xl text-center">
        <p className="text-zinc-300">{promptLabel}</p>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`px-3 py-1.5 rounded text-sm border ${
                selectedType === option.value ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"
              }`}
              onClick={() => {
                requestIdRef.current += 1;
                setItems([]);
                setIndex(0);
                setPage(1);
                setHasMore(false);
                setShowRating(false);
                setHoverRating(null);
                setError(null);
                setSelectedType(option.value);
                void loadItems(option.value, 1, false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {selectedType && loading && items.length === 0 ? <p className="mt-6 text-zinc-400">Loading picks...</p> : null}

      {selectedType && !loading && !current ? (
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-zinc-300">No more items right now. Try another media type.</p>
        </div>
      ) : null}

      {current ? (
        <section className="mt-6 mx-auto w-full max-w-4xl">
          <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-[140px_220px_280px] md:items-start md:justify-center md:gap-6">
            <div className="w-full md:w-[140px] flex justify-center md:justify-end md:pt-2">
              <button
                type="button"
                className="px-3 py-2 rounded border border-zinc-700 text-sm hover:bg-zinc-800 disabled:opacity-60"
                disabled={saving || loading}
                onClick={() => void moveToNext()}
              >
                Skip
              </button>
            </div>

            <article className="w-[220px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="relative aspect-[2/3] bg-zinc-950">
                {current.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.posterUrl} alt={current.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-sm text-zinc-500">No Poster</div>
                )}
                <span className="absolute right-2 top-2 text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 bg-black/70 text-zinc-200 uppercase tracking-wide">
                  {mediaTypeLabel(current.mediaType)}
                </span>
              </div>
              <div className="p-2.5">
                <p className="text-base text-zinc-100">{current.title}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {typeof current.rating === "number" ? `${current.rating.toFixed(1)}/10` : "No rating"}
                </p>
              </div>
            </article>

            <div className="w-full max-w-[280px] md:w-[280px] md:pt-2">
              {!showRating ? (
                <button
                  type="button"
                  className="w-full px-3 py-2 rounded bg-white text-black text-sm hover:bg-zinc-200 disabled:opacity-60"
                  disabled={saving}
                  onClick={() => setShowRating(true)}
                >
                  Check
                </button>
              ) : (
                <div className="w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/70 p-2" onMouseLeave={() => setHoverRating(null)}>
                  <p className="text-xs text-zinc-300 mb-2">Rate it (0.5 steps) and it will be added to Completed.</p>
                  <div className="flex w-full flex-nowrap justify-between gap-1">
                    {Array.from({ length: STAR_COUNT }, (_, i) => {
                      const fill = Math.max(0, Math.min(1, displayRating - i));
                      return (
                        <button
                          key={i}
                          type="button"
                          className="relative h-5 w-5 shrink-0 disabled:opacity-60"
                          disabled={saving}
                          onMouseMove={(e) => setHoverRating(getStarValue(i, e.clientX, e.currentTarget.getBoundingClientRect()))}
                          onClick={(e) => {
                            const value = getStarValue(i, e.clientX, e.currentTarget.getBoundingClientRect());
                            void saveRating(value);
                          }}
                          aria-label={`Set rating to ${i + 1}`}
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5">
                            <path
                              d="M12 2.2l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 16.5l-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.9L12 2.2z"
                              fill="none"
                              stroke="#a3a3a3"
                              strokeWidth="1.6"
                            />
                          </svg>
                          <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                            <svg viewBox="0 0 24 24" className="h-5 w-5">
                              <path d="M12 2.2l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 16.5l-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.9L12 2.2z" fill="#facc15" />
                            </svg>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border border-zinc-700 text-xs hover:bg-zinc-800 disabled:opacity-60"
                      disabled={saving}
                      onClick={() => {
                        setShowRating(false);
                        setHoverRating(null);
                      }}
                    >
                      Cancel
                    </button>
                    {saving ? <span className="text-xs text-zinc-400">Saving...</span> : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
