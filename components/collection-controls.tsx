"use client";

import Link from "next/link";
import { useState } from "react";
import type { CollectionStatus } from "@/lib/account/types";
import { getCollectionItem, getProfile, removeCollectionItem, upsertCollectionItem } from "@/lib/account/storage";
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
  const [, setRefresh] = useState(0);
  const signedIn = Boolean(getProfile());
  const existing = getCollectionItem(mediaType, externalId);
  const [draftStatus, setDraftStatus] = useState<CollectionStatus | null>(null);
  const saved = Boolean(existing);
  const status = draftStatus ?? existing?.status ?? "wishlist";

  if (!signedIn) {
    return (
      <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm">
        <span className="text-gray-300">Sign in to track this title. </span>
        <Link href="/account" className="text-white underline">
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm"
          value={status}
          onChange={(e) => setDraftStatus(e.target.value as CollectionStatus)}
        >
          <option value="wishlist">Wishlist</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <button
          type="button"
          className="px-3 py-1 rounded bg-white text-black text-sm hover:bg-zinc-200"
          onClick={() => {
            upsertCollectionItem({ mediaType, externalId, source, title, posterUrl, rating }, status);
            setDraftStatus(null);
            setRefresh((v) => v + 1);
          }}
        >
          {saved ? "Update" : "Add to Collection"}
        </button>

        {saved ? (
          <button
            type="button"
            className="px-3 py-1 rounded border border-zinc-700 text-sm hover:bg-zinc-800"
            onClick={() => {
              removeCollectionItem(mediaType, externalId);
              setDraftStatus(null);
              setRefresh((v) => v + 1);
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
