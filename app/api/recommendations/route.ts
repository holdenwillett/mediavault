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
const COLLECTION_SCAN_LIMIT = 5000;

function shuffleItems<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sprinkleItems(primary: MediaSearchItem[], sprinkle: MediaSearchItem[], every: number): MediaSearchItem[] {
  const result: MediaSearchItem[] = [];
  const seen = new Set<string>();
  let p = 0;
  let s = 0;

  while (p < primary.length || s < sprinkle.length) {
    for (let i = 0; i < every && p < primary.length; i += 1) {
      const item = primary[p];
      p += 1;
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }

    if (s < sprinkle.length) {
      const item = sprinkle[s];
      s += 1;
      const key = keyOf(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    if (p >= primary.length && s >= sprinkle.length) break;
  }

  return result;
}

function scoreSeed(item: CollectionRow): number {
  const userRating = typeof item.user_rating === "number" ? item.user_rating : 0;
  const rating = typeof item.rating === "number" ? item.rating : 0;
  const statusBoost = item.status === "completed" ? 2 : item.status === "in_progress" ? 1 : 0;
  return userRating * 2 + rating + statusBoost;
}

function keyOf(item: MediaSearchItem): string {
  return `${item.source}:${item.mediaType}:${String(item.externalId)}`;
}

function appendUniqueItems(target: MediaSearchItem[], incoming: MediaSearchItem[]) {
  const seen = new Set(target.map(keyOf));
  for (const item of incoming) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(item);
  }
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

async function fetchTmdbPopularFallback(type: "movie" | "tv", apiKey: string): Promise<MediaSearchItem[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/${type}?language=en-US&sort_by=popularity.desc&include_adult=false&vote_count.gte=50&page=1&api_key=${apiKey}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as TmdbRecommendationsResponse;
  return (data.results ?? [])
    .map((item) => normalizeTmdbSearchItem({ ...item, media_type: type }))
    .filter((item) => !!item.posterUrl)
    .slice(0, 12);
}

async function fetchRawgPopularFallback(apiKey: string): Promise<MediaSearchItem[]> {
  const res = await fetch(`https://api.rawg.io/api/games?key=${apiKey}&ordering=-added&page_size=24&page=1`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as RawgSuggestionsResponse;
  return (data.results ?? []).map(normalizeRawgGame).filter((item) => !!item.posterUrl).slice(0, 12);
}

async function fetchTmdbTrending(type: "movie" | "tv", apiKey: string): Promise<MediaSearchItem[]> {
  const res = await fetch(`https://api.themoviedb.org/3/trending/${type}/week?api_key=${apiKey}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as TmdbRecommendationsResponse;
  return (data.results ?? [])
    .map((item) => normalizeTmdbSearchItem({ ...item, media_type: type }))
    .filter((item) => !!item.posterUrl)
    .slice(0, 10);
}

async function fetchRawgTrending(apiKey: string): Promise<MediaSearchItem[]> {
  const res = await fetch(`https://api.rawg.io/api/games?key=${apiKey}&ordering=-added&page_size=20&page=1`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as RawgSuggestionsResponse;
  return (data.results ?? []).map(normalizeRawgGame).filter((item) => !!item.posterUrl).slice(0, 10);
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
    .limit(COLLECTION_SCAN_LIMIT);

  let rows = (initial.data ?? []) as CollectionRow[];
  if (initial.error) {
    const fallback = await supabase
      .from("collection_entries")
      .select(LEGACY_SELECT)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(COLLECTION_SCAN_LIMIT);
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
  const existingByTypeId = new Set(rows.map((row) => `${row.media_type}:${String(row.external_id)}`));
  const deduped: MediaSearchItem[] = [];
  const seen = new Set<string>();

  for (const item of batches.flat()) {
    const key = keyOf(item);
    const typeIdKey = `${item.mediaType}:${String(item.externalId)}`;
    if (seen.has(key) || existingKeys.has(key) || existingByTypeId.has(typeIdKey)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 24) break;
  }

  const byType = {
    movie: deduped.filter((item) => item.mediaType === "movie").length,
    tv: deduped.filter((item) => item.mediaType === "tv").length,
    game: deduped.filter((item) => item.mediaType === "game").length,
  };

  if (tmdbApiKey && byType.movie < 4) {
    const fallbackMovies = await fetchTmdbPopularFallback("movie", tmdbApiKey);
    appendUniqueItems(deduped, fallbackMovies);
  }
  if (tmdbApiKey && byType.tv < 4) {
    const fallbackTv = await fetchTmdbPopularFallback("tv", tmdbApiKey);
    appendUniqueItems(deduped, fallbackTv);
  }
  if (rawgApiKey && byType.game < 4) {
    const fallbackGames = await fetchRawgPopularFallback(rawgApiKey);
    appendUniqueItems(deduped, fallbackGames);
  }

  const [trendingMovies, trendingTv, trendingGames] = await Promise.all([
    tmdbApiKey ? fetchTmdbTrending("movie", tmdbApiKey) : Promise.resolve([]),
    tmdbApiKey ? fetchTmdbTrending("tv", tmdbApiKey) : Promise.resolve([]),
    rawgApiKey ? fetchRawgTrending(rawgApiKey) : Promise.resolve([]),
  ]);
  const trendingPool = [...trendingMovies, ...trendingTv, ...trendingGames];

  const isNotInCollection = (item: MediaSearchItem) => {
    const sourceKey = `${item.source}:${item.mediaType}:${String(item.externalId)}`;
    const typeIdKey = `${item.mediaType}:${String(item.externalId)}`;
    return !existingKeys.has(sourceKey) && !existingByTypeId.has(typeIdKey);
  };

  const primaryFiltered = deduped.filter(isNotInCollection);
  const trendingFiltered = trendingPool.filter(isNotInCollection);
  const mixed = sprinkleItems(shuffleItems(primaryFiltered), shuffleItems(trendingFiltered), 4);

  return NextResponse.json({ items: mixed.slice(0, 24), basedOn });
}
