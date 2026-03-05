"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CollectionEntry, CollectionList, CollectionStatus } from "@/lib/account/types";
import type { MediaSource, MediaType } from "@/lib/media/types";

const STAR_COUNT = 10;

type Props = {
  mediaType: MediaType;
  externalId: string | number;
  source: MediaSource;
  title: string;
  posterUrl?: string | null;
  rating?: number;
};

export function CollectionControls({ mediaType, externalId, source, title, posterUrl, rating }: Props) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [existing, setExisting] = useState<CollectionEntry | null>(null);
  const [lists, setLists] = useState<CollectionList[]>([]);
  const [status, setStatus] = useState<CollectionStatus>("wishlist");
  const [listId, setListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ mediaType, externalId: String(externalId) });
      try {
        const [res, listRes] = await Promise.all([
          fetch(`/api/collections?${params.toString()}`, { cache: "no-store" }),
          fetch("/api/collections/lists", { cache: "no-store" }),
        ]);
        if (!active) return;

        if (res.status === 401 || listRes.status === 401) {
          setSignedIn(false);
          setExisting(null);
          setLists([]);
          setStatus("wishlist");
          setListId("");
          setUserRating(null);
          setLoading(false);
          router.push(`/account?next=/${mediaType}/${encodeURIComponent(String(externalId))}&reason=session-expired`);
          return;
        }
        if (!res.ok || !listRes.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const listData = (await listRes.json().catch(() => ({}))) as { error?: string };
          setSignedIn(false);
          setExisting(null);
          setLists([]);
          setStatus("wishlist");
          setListId("");
          setUserRating(null);
          setError(data.error ?? listData.error ?? "Could not load collection state.");
          setLoading(false);
          return;
        }

        const data = (await res.json()) as { items?: CollectionEntry[] };
        const listData = (await listRes.json()) as { lists?: CollectionList[] };
        const item = data.items?.[0] ?? null;
        setSignedIn(true);
        setExisting(item);
        setLists(listData.lists ?? []);
        setStatus(item?.status ?? "wishlist");
        setListId(item?.listId ?? "");
        setUserRating(typeof item?.userRating === "number" ? Number(item.userRating.toFixed(1)) : null);
        setLoading(false);
      } catch {
        if (!active) return;
        setSignedIn(false);
        setExisting(null);
        setLists([]);
        setStatus("wishlist");
        setListId("");
        setUserRating(null);
        setError("Network error while loading collection state.");
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [externalId, mediaType, router]);

  if (loading) return null;

  if (error) {
    return (
      <div className="mt-5 rounded-lg border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm">
        <span className="text-gray-300">Sign in to track this title. </span>
        <Link href="/account" className="text-white underline">
          Go to Account
        </Link>
      </div>
    );
  }

  const saved = Boolean(existing);
  const displayRating = hoverRating ?? userRating ?? 0;

  const getHoverValue = (starIndex: number, clientX: number, rect: DOMRect) => {
    const isLeftHalf = clientX - rect.left < rect.width / 2;
    return starIndex + (isLeftHalf ? 0.5 : 1);
  };

  const saveCollection = async (overrides?: {
    userRating?: number | null;
    status?: CollectionStatus;
    listId?: string;
  }) => {
    setError(null);
    setSaving(true);

    const effectiveUserRating = typeof overrides?.userRating !== "undefined" ? overrides.userRating : userRating;
    const effectiveStatus = overrides?.status ?? status;
    const effectiveListId = typeof overrides?.listId !== "undefined" ? overrides.listId : listId;

    const saveRes = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType,
        externalId,
        source,
        title,
        posterUrl,
        rating,
        userRating: effectiveUserRating,
        status: effectiveStatus,
        listId: effectiveListId || null,
      }),
    });
    if (saveRes.status === 401) {
      setSignedIn(false);
      setExisting(null);
      setStatus("wishlist");
      setListId("");
      setUserRating(null);
      setSaving(false);
      router.push(`/account?next=/${mediaType}/${encodeURIComponent(String(externalId))}&reason=session-expired`);
      return;
    }
    if (!saveRes.ok) {
      const data = (await saveRes.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save this item.");
      setSaving(false);
      return;
    }

    const data = (await saveRes.json()) as { item?: CollectionEntry };
    const item = data.item ?? null;
    setExisting(item);
    setStatus(item?.status ?? effectiveStatus);
    setListId(item?.listId ?? (effectiveListId || ""));
    setUserRating(typeof item?.userRating === "number" ? Number(item.userRating.toFixed(1)) : effectiveUserRating ?? null);
    setSaving(false);
  };

  return (
    <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm text-zinc-300">
          Status
          <select
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as CollectionStatus)}
          >
            <option value="wishlist">Wishlist</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <label className="text-sm text-zinc-300">
          Your Rating (0-10)
          <div
            className="mt-2 rounded-lg border border-zinc-700 bg-zinc-800/70 p-2"
            onMouseLeave={() => setHoverRating(null)}
          >
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: STAR_COUNT }, (_, i) => {
                const fill = Math.max(0, Math.min(1, displayRating - i));
                return (
                  <button
                    key={i}
                    type="button"
                    className="relative h-8 w-8 disabled:opacity-60"
                    disabled={saving}
                    onMouseMove={(e) => setHoverRating(getHoverValue(i, e.clientX, e.currentTarget.getBoundingClientRect()))}
                    onClick={(e) => {
                      const selectedRating = getHoverValue(i, e.clientX, e.currentTarget.getBoundingClientRect());
                      setUserRating(selectedRating);
                      setStatus("completed");
                      void saveCollection({ userRating: selectedRating, status: "completed" });
                    }}
                    aria-label={`Set rating to ${i + 1}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-8 w-8">
                      <path
                        d="M12 2.2l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 16.5l-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.9L12 2.2z"
                        fill="none"
                        stroke="#a3a3a3"
                        strokeWidth="1.6"
                      />
                    </svg>
                    <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                      <svg viewBox="0 0 24 24" className="h-8 w-8">
                        <path d="M12 2.2l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 16.5l-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.9L12 2.2z" fill="#facc15" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-xs text-zinc-300">{userRating === null ? "No rating" : `${userRating.toFixed(1)} / 10`}</p>
              <button
                type="button"
                className="text-xs text-zinc-400 underline hover:text-zinc-200"
                disabled={saving}
                onClick={() => {
                  setUserRating(null);
                  setHoverRating(null);
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </label>

        <label className="text-sm text-zinc-300">
          List
          <select
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm"
            value={listId}
            onChange={(e) => setListId(e.target.value)}
          >
            <option value="">No list</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm text-zinc-300">
          New List
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm"
              placeholder="Favorites"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
            <button
              type="button"
              className="px-3 py-2 rounded border border-zinc-700 text-sm hover:bg-zinc-800"
              onClick={async () => {
                const name = newListName.trim();
                if (!name) return;
                setError(null);
                const res = await fetch("/api/collections/lists", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name }),
                });
                if (res.status === 401) {
                  setSignedIn(false);
                  router.push(`/account?next=/${mediaType}/${encodeURIComponent(String(externalId))}&reason=session-expired`);
                  return;
                }
                if (!res.ok) {
                  const data = (await res.json().catch(() => ({}))) as { error?: string };
                  setError(data.error ?? "Could not create list.");
                  return;
                }
                const data = (await res.json()) as { list?: CollectionList };
                const createdList = data.list;
                if (!createdList) return;
                setLists((prev) => [...prev, createdList].sort((a, b) => a.name.localeCompare(b.name)));
                setListId(createdList.id);
                setNewListName("");
              }}
            >
              Create
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className="px-3 py-1 rounded bg-white text-black text-sm hover:bg-zinc-200 disabled:opacity-60"
          disabled={saving}
          onClick={async () => {
            await saveCollection();
          }}
        >
          {saving ? "Saving..." : saved ? "Update" : "Add to Collection"}
        </button>

        {saved ? (
          <button
            type="button"
            className="px-3 py-1 rounded border border-zinc-700 text-sm hover:bg-zinc-800 disabled:opacity-60"
            disabled={saving}
            onClick={async () => {
              if (!existing) return;
              setError(null);
              const res = await fetch(`/api/collections/${encodeURIComponent(existing.id)}`, { method: "DELETE" });
              if (res.status === 401) {
                setSignedIn(false);
                setExisting(null);
                setStatus("wishlist");
                setListId("");
                setUserRating(null);
                router.push(`/account?next=/${mediaType}/${encodeURIComponent(String(externalId))}&reason=session-expired`);
                return;
              }
              if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                setError(data.error ?? "Could not remove this item.");
                return;
              }
              setExisting(null);
              setStatus("wishlist");
              setListId("");
              setUserRating(null);
            }}
          >
            Remove
          </button>
        ) : null}

        <Link href="/collections" className="text-sm text-gray-300 hover:text-white underline">
          View Collection
        </Link>
      </div>
    </div>
  );
}
