"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CollectionEntry, CollectionStatus } from "@/lib/account/types";
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
  const [status, setStatus] = useState<CollectionStatus>("wishlist");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ mediaType, externalId: String(externalId) });
      try {
        const res = await fetch(`/api/collections?${params.toString()}`, { cache: "no-store" });
        if (!active) return;

        if (res.status === 401) {
          setSignedIn(false);
          setExisting(null);
          setStatus("wishlist");
          setLoading(false);
          router.push(`/account?next=/${mediaType}/${encodeURIComponent(String(externalId))}&reason=session-expired`);
          return;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setSignedIn(false);
          setExisting(null);
          setStatus("wishlist");
          setError(data.error ?? "Could not load collection state.");
          setLoading(false);
          return;
        }

        const data = (await res.json()) as { items?: CollectionEntry[] };
        const item = data.items?.[0] ?? null;
        setSignedIn(true);
        setExisting(item);
        setStatus(item?.status ?? "wishlist");
        setLoading(false);
      } catch {
        if (!active) return;
        setSignedIn(false);
        setExisting(null);
        setStatus("wishlist");
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
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as CollectionStatus)}
        >
          <option value="wishlist">Wishlist</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <button
          type="button"
          className="px-3 py-1 rounded bg-white text-black text-sm hover:bg-zinc-200"
          onClick={async () => {
            setError(null);
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
                status,
              }),
            });
            if (saveRes.status === 401) {
              setSignedIn(false);
              setExisting(null);
              setStatus("wishlist");
              router.push(`/account?next=/${mediaType}/${encodeURIComponent(String(externalId))}&reason=session-expired`);
              return;
            }
            if (!saveRes.ok) {
              const data = (await saveRes.json().catch(() => ({}))) as { error?: string };
              setError(data.error ?? "Could not save this item.");
              return;
            }

            const params = new URLSearchParams({ mediaType, externalId: String(externalId) });
            const res = await fetch(`/api/collections?${params.toString()}`, { cache: "no-store" });
            if (res.status === 401) {
              setSignedIn(false);
              setExisting(null);
              setStatus("wishlist");
              router.push(`/account?next=/${mediaType}/${encodeURIComponent(String(externalId))}&reason=session-expired`);
              return;
            }
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              setError(data.error ?? "Could not refresh collection state.");
              return;
            }
            const data = (await res.json()) as { items?: CollectionEntry[] };
            const item = data.items?.[0] ?? null;
            setExisting(item);
            setStatus(item?.status ?? "wishlist");
          }}
        >
          {saved ? "Update" : "Add to Collection"}
        </button>

        {saved ? (
          <button
            type="button"
            className="px-3 py-1 rounded border border-zinc-700 text-sm hover:bg-zinc-800"
            onClick={async () => {
              setError(null);
              const res = await fetch(`/api/collections/${encodeURIComponent(existing.id)}`, { method: "DELETE" });
              if (res.status === 401) {
                setSignedIn(false);
                setExisting(null);
                setStatus("wishlist");
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
