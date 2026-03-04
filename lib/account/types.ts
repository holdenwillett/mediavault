import type { MediaSource, MediaType } from "@/lib/media/types";

export type CollectionStatus = "wishlist" | "in_progress" | "completed";

export type AccountProfile = {
  id: string;
  name: string;
  createdAt: string;
};

export type CollectionEntry = {
  id: string;
  userId: string;
  mediaType: MediaType;
  externalId: number | string;
  source: MediaSource;
  title: string;
  posterUrl?: string | null;
  rating?: number;
  status: CollectionStatus;
  addedAt: string;
  updatedAt: string;
};
