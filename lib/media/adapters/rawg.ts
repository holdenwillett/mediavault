import type { MediaSearchItem } from "@/lib/media/types";

export type RawgGame = {
  id: number;
  name?: string;
  background_image?: string | null;
  rating?: number;
  ratings_count?: number;
  added?: number;
  released?: string;
  slug?: string;
};

export function normalizeRawgGame(game: RawgGame): MediaSearchItem {
  const normalizedRating = typeof game.rating === "number" ? Math.min(game.rating * 2, 10) : undefined;

  return {
    id: `rawg:game:${game.id}`,
    externalId: game.id,
    mediaType: "game",
    source: "rawg",
    title: game.name ?? "Untitled",
    posterUrl: game.background_image ?? null,
    rating: normalizedRating,
    popularity: game.added,
    voteCount: game.ratings_count,
    releaseDate: game.released,
  };
}
