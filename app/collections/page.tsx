"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CollectionEntry, CollectionStatus } from "@/lib/account/types";
import { getCollection, getProfile, removeCollectionItem, upsertCollectionItem } from "@/lib/account/storage";

const STATUS_LABEL: Record<CollectionStatus, string> = {
  wishlist: "Wishlist",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_ORDER: CollectionStatus[] = ["wishlist", "in_progress", "completed"];

export default function CollectionsPage() {
  const [, setRefresh] = useState(0);
  const signedIn = Boolean(getProfile());
  const items = getCollection();

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
        </div>
      </div>

      {!signedIn ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-zinc-300">Create an account first to track a collection.</p>
          <Link href="/account" className="text-white underline">
            Go to Account
          </Link>
        </div>
      ) : null}

      {signedIn &&
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
                        onClick={() => {
                          const nextStatus: CollectionStatus =
                            status === "wishlist" ? "in_progress" : status === "in_progress" ? "completed" : "wishlist";
                          upsertCollectionItem(
                            {
                              mediaType: item.mediaType,
                              externalId: item.externalId,
                              source: item.source,
                              title: item.title,
                              posterUrl: item.posterUrl,
                              rating: item.rating,
                            },
                            nextStatus
                          );
                          setRefresh((v) => v + 1);
                        }}
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
                        onClick={() => {
                          removeCollectionItem(item.mediaType, item.externalId);
                          setRefresh((v) => v + 1);
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
