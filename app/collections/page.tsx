"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CollectionEntry, CollectionStatus } from "@/lib/account/types";

const STATUS_LABEL: Record<CollectionStatus, string> = {
  wishlist: "Wishlist",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_ORDER: CollectionStatus[] = ["wishlist", "in_progress", "completed"];

export default function CollectionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CollectionEntry[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      setSessionExpired(false);
      try {
        const res = await fetch("/api/collections", { cache: "no-store" });
        if (!active) return;
        if (res.status === 401) {
          setSignedIn(false);
          setSessionExpired(true);
          setItems([]);
          setLoading(false);
          router.push("/account?next=/collections&reason=session-expired");
          return;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setSignedIn(false);
          setItems([]);
          setError(data.error ?? "Could not load your collection.");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { items?: CollectionEntry[] };
        setSignedIn(true);
        setItems(data.items ?? []);
        setLoading(false);
      } catch {
        if (!active) return;
        setSignedIn(false);
        setItems([]);
        setError("Network error while loading your collection.");
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reload, router]);

  const grouped = useMemo(() => {
    const byStatus: Record<CollectionStatus, CollectionEntry[]> = {
      wishlist: [],
      in_progress: [],
      completed: [],
    };
    const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const item of sorted) byStatus[item.status].push(item);
    return byStatus;
  }, [items]);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Collection</h1>
        <div className="flex items-center gap-4">
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

      {!loading &&
        signedIn &&
        STATUS_ORDER.map((status) => (
          <section key={status} className="mt-8">
            <h2 className="text-xl font-semibold mb-3">{STATUS_LABEL[status]}</h2>
            {grouped[status].length === 0 ? (
              <p className="text-sm text-zinc-500">No items yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {grouped[status].map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <Link href={`/${item.mediaType}/${item.externalId}`} className="block">
                      <p className="font-medium">{item.title}</p>
                    </Link>
                    <p className="text-xs text-zinc-400 mt-1 uppercase">{item.mediaType}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
                        onClick={async () => {
                          const nextStatus: CollectionStatus =
                            status === "wishlist" ? "in_progress" : status === "in_progress" ? "completed" : "wishlist";
                          const res = await fetch(`/api/collections/${encodeURIComponent(item.id)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: nextStatus }),
                          });
                          if (res.status === 401) {
                            setSignedIn(false);
                            setSessionExpired(true);
                            router.push("/account?next=/collections&reason=session-expired");
                            return;
                          }
                          setReload((v) => v + 1);
                        }}
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
                        onClick={async () => {
                          const res = await fetch(`/api/collections/${encodeURIComponent(item.id)}`, { method: "DELETE" });
                          if (res.status === 401) {
                            setSignedIn(false);
                            setSessionExpired(true);
                            router.push("/account?next=/collections&reason=session-expired");
                            return;
                          }
                          setReload((v) => v + 1);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
    </main>
  );
}
