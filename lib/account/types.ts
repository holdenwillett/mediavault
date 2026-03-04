import type { MediaSource, MediaType } from "@/lib/media/types";

export type CollectionStatus = "wishlist" | "in_progress" | "completed";

export type CollectionList = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
  userRating?: number | null;
  status: CollectionStatus;
  listId?: string | null;
  listName?: string | null;
  addedAt: string;
  updatedAt: string;
};
