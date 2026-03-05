import { NextResponse } from "next/server";
import type { MediaSearchItem, MediaType } from "@/lib/media/types";
import { normalizeRawgGame, type RawgGame } from "@/lib/media/adapters/rawg";
import { normalizeTmdbSearchItem, type TmdbSearchItem } from "@/lib/media/adapters/tmdb";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CollectionRow = {
  media_type: MediaType;
  external_id: string;
  source: string;
  title: string;
  status: "wishlist" | "in_progress" | "completed";
  rating?: number | null;
  user_rating?: number | null;
  updated_at: string;
};

type TmdbRecommendationsResponse = {
  results?: TmdbSearchItem[];
};

type RawgSuggestionsResponse = {
  results?: RawgGame[];
};

const FULL_SELECT = "media_type, external_id, source, title, status, rating, user_rating, updated_at";
const LEGACY_SELECT = "media_type, external_id, source, title, status, rating, updated_at";

function scoreSeed(item: CollectionRow): number {
  const userRating = typeof item.user_rating === "number" ? item.user_rating : 0;
  const rating = typeof item.rating === "number" ? item.rating : 0;
  const statusBoost = item.status === "completed" ? 2 : item.status === "in_progress" ? 1 : 0;
  return userRating * 2 + rating + statusBoost;
}

function keyOf(item: MediaSearchItem): string {
  return `${item.source}:${item.mediaType}:${String(item.externalId)}`;
}

async function fetchTmdbRecommendations(seed: CollectionRow, apiKey: string): Promise<MediaSearchItem[]> {
  if ((seed.media_type !== "movie" && seed.media_type !== "tv") || seed.source !== "tmdb") return [];
  const mediaType = seed.media_type === "movie" ? "movie" : "tv";
  const res = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${encodeURIComponent(
      seed.external_id
    )}/recommendations?language=en-US&page=1&api_key=${apiKey}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as TmdbRecommendationsResponse;
  return (data.results ?? [])
    .map((item) => normalizeTmdbSearchItem({ ...item, media_type: mediaType }))
    .filter((item) => !!item.posterUrl);
}

async function fetchRawgSuggestions(seed: CollectionRow, apiKey: string): Promise<MediaSearchItem[]> {
  if (seed.media_type !== "game" || seed.source !== "rawg") return [];
  const res = await fetch(
    `https://api.rawg.io/api/games/${encodeURIComponent(seed.external_id)}/suggested?key=${apiKey}&page_size=10`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as RawgSuggestionsResponse;
  return (data.results ?? []).map(normalizeRawgGame).filter((item) => !!item.posterUrl);
}

export async function GET() {
  const supabase = await createSupabaseServerClient().catch(() => null);
  if (!supabase) return NextResponse.json({ items: [], basedOn: [] });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ items: [], basedOn: [] });

  const initial = await supabase
    .from("collection_entries")
    .select(FULL_SELECT)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(24);

  let rows = (initial.data ?? []) as CollectionRow[];
  if (initial.error) {
    const fallback = await supabase
      .from("collection_entries")
      .select(LEGACY_SELECT)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(24);
    if (fallback.error) return NextResponse.json({ items: [], basedOn: [] });
    rows = ((fallback.data ?? []) as CollectionRow[]).map((row) => ({ ...row, user_rating: null }));
  }

  if (!rows.length) return NextResponse.json({ items: [], basedOn: [] });

  const seeds = [...rows].sort((a, b) => scoreSeed(b) - scoreSeed(a)).slice(0, 6);
  const basedOn = seeds.map((seed) => seed.title).filter(Boolean).slice(0, 3);

  const tmdbApiKey = process.env.TMDB_API_KEY;
  const rawgApiKey = process.env.RAWG_API_KEY;
  const batches = await Promise.all(
    seeds.map(async (seed) => {
      if (seed.source === "tmdb" && tmdbApiKey) return fetchTmdbRecommendations(seed, tmdbApiKey);
      if (seed.source === "rawg" && rawgApiKey) return fetchRawgSuggestions(seed, rawgApiKey);
      return [];
    })
  );

  const existingKeys = new Set(rows.map((row) => `${row.source}:${row.media_type}:${String(row.external_id)}`));
  const deduped: MediaSearchItem[] = [];
  const seen = new Set<string>();

  for (const item of batches.flat()) {
    const key = keyOf(item);
    if (seen.has(key) || existingKeys.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 24) break;
  }

  return NextResponse.json({ items: deduped, basedOn });
}
