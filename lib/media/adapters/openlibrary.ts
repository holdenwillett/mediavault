import type { MediaSearchItem } from "@/lib/media/types";

export type OpenLibraryDoc = {
  key?: string;
  title?: string;
  cover_i?: number;
  first_publish_year?: number;
  ratings_average?: number;
  ratings_count?: number;
  subject?: string[];
};

function coverUrl(coverId?: number): string | null {
  if (!coverId) return null;
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

function normalizedComicId(key?: string): string {
  if (!key) return "";
  const id = key.split("/").filter(Boolean).pop();
  return id ?? "";
}

export function normalizeOpenLibraryDoc(doc: OpenLibraryDoc): MediaSearchItem | null {
  const comicId = normalizedComicId(doc.key);
  if (!comicId) return null;

  return {
    id: `openlibrary:comic:${comicId}`,
    externalId: comicId,
    mediaType: "comic",
    source: "openlibrary",
    title: doc.title ?? "Untitled",
    posterUrl: coverUrl(doc.cover_i),
    rating: doc.ratings_average,
    voteCount: doc.ratings_count,
    popularity: doc.ratings_count,
    releaseDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    overview: doc.subject?.slice(0, 6).join(", "),
  };
}
