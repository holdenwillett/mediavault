import type { MediaSearchItem } from "@/lib/media/types";

type TmdbMediaType = "movie" | "tv";

export type TmdbSearchItem = {
  id: number;
  media_type: TmdbMediaType;
  popularity?: number;
  vote_count?: number;
  vote_average?: number;
  poster_path?: string | null;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
};

export function normalizeTmdbSearchItem(item: TmdbSearchItem): MediaSearchItem {
  const title = item.title ?? item.name ?? "Untitled";
  const releaseDate = item.release_date ?? item.first_air_date;

  return {
    id: `tmdb:${item.media_type}:${item.id}`,
    externalId: item.id,
    mediaType: item.media_type,
    source: "tmdb",
    title,
    posterPath: item.poster_path,
    rating: item.vote_average,
    popularity: item.popularity,
    voteCount: item.vote_count,
    overview: item.overview,
    releaseDate,
  };
}
