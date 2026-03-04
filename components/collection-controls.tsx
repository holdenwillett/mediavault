"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CollectionEntry, CollectionList, CollectionStatus } from "@/lib/account/types";
import type { MediaSource, MediaType } from "@/lib/media/types";

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
  const [userRating, setUserRating] = useState("");
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
          setUserRating("");
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
          setUserRating("");
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
        setUserRating(typeof item?.userRating === "number" ? item.userRating.toFixed(1) : "");
        setLoading(false);
      } catch {
        if (!active) return;
        setSignedIn(false);
        setExisting(null);
        setLists([]);
        setStatus("wishlist");
        setListId("");
        setUserRating("");
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
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            inputMode="decimal"
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm"
            placeholder="8.5"
            value={userRating}
            onChange={(e) => setUserRating(e.target.value)}
          />
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
          className="px-3 py-1 rounded bg-white text-black text-sm hover:bg-zinc-200"
          onClick={async () => {
            setError(null);
            const parsedUserRating = userRating.trim() === "" ? null : Number(userRating);
            if (parsedUserRating !== null && (Number.isNaN(parsedUserRating) || parsedUserRating < 0 || parsedUserRating > 10)) {
              setError("Your rating must be between 0 and 10.");
              return;
            }

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
                userRating: parsedUserRating,
                status,
                listId: listId || null,
              }),
            });
            if (saveRes.status === 401) {
              setSignedIn(false);
              setExisting(null);
              setStatus("wishlist");
              setListId("");
              setUserRating("");
              router.push(`/account?next=/${mediaType}/${encodeURIComponent(String(externalId))}&reason=session-expired`);
              return;
            }
            if (!saveRes.ok) {
              const data = (await saveRes.json().catch(() => ({}))) as { error?: string };
              setError(data.error ?? "Could not save this item.");
              return;
            }

            const data = (await saveRes.json()) as { item?: CollectionEntry };
            const item = data.item ?? null;
            setExisting(item);
            setStatus(item?.status ?? "wishlist");
            setListId(item?.listId ?? "");
            setUserRating(typeof item?.userRating === "number" ? item.userRating.toFixed(1) : "");
          }}
        >
          {saved ? "Update" : "Add to Collection"}
        </button>

        {saved ? (
          <button
            type="button"
            className="px-3 py-1 rounded border border-zinc-700 text-sm hover:bg-zinc-800"
            onClick={async () => {
              if (!existing) return;
              setError(null);
              const res = await fetch(`/api/collections/${encodeURIComponent(existing.id)}`, { method: "DELETE" });
              if (res.status === 401) {
                setSignedIn(false);
                setExisting(null);
                setStatus("wishlist");
                setListId("");
                setUserRating("");
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
              setUserRating("");
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
