export type MediaType = "movie" | "tv" | "game";

export type MediaSource = "tmdb" | "rawg" | "igdb" | "comicvine";

export type MediaSearchItem = {
  id: string;
  externalId: number | string;
  mediaType: MediaType;
  source: MediaSource;
  title: string;
  posterUrl?: string | null;
  rating?: number;
  popularity?: number;
  voteCount?: number;
  overview?: string;
  releaseDate?: string;
};

export type MediaSearchResponse = {
  top: MediaSearchItem[];
  related: MediaSearchItem[];
  page: number;
  hasMore: boolean;
  error?: string;
};
