import { NextResponse } from "next/server";
import type { MediaSearchItem, MediaType } from "@/lib/media/types";
import { normalizeRawgGame, type RawgGame } from "@/lib/media/adapters/rawg";
import { normalizeTmdbSearchItem, type TmdbSearchItem } from "@/lib/media/adapters/tmdb";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type QuickAddType = MediaType;

type TmdbDiscoverResponse = {
  results?: TmdbSearchItem[];
  total_pages?: number;
};

type RawgListResponse = {
  results?: RawgGame[];
  next?: string | null;
};

type CollectionRow = {
  source: string;
  media_type: MediaType;
  external_id: string;
  status?: "wishlist" | "in_progress" | "completed";
  rating?: number | null;
  user_rating?: number | null;
  updated_at?: string | null;
};

type TmdbRecommendationsResponse = {
  results?: TmdbSearchItem[];
};

function scoreSeed(item: CollectionRow): number {
  const statusBoost = item.status === "completed" ? 2 : item.status === "in_progress" ? 1 : 0;
  const userRating = typeof item.user_rating === "number" ? item.user_rating : 0;
  const rating = typeof item.rating === "number" ? item.rating : 0;
  const recencyBoost = item.updated_at ? Date.parse(item.updated_at) / 1_000_000_000_000 : 0;
  return userRating * 2 + rating + statusBoost + recencyBoost;
}

function toKey(source: string, mediaType: string, externalId: string | number): string {
  return `${source}:${mediaType}:${String(externalId)}`;
}

function appendUnique(target: MediaSearchItem[], incoming: MediaSearchItem[]) {
  const seen = new Set(target.map((item) => toKey(item.source, item.mediaType, item.externalId)));
  for (const item of incoming) {
    const key = toKey(item.source, item.mediaType, item.externalId);
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(item);
  }
}

function mixTailoredAndPopular(tailored: MediaSearchItem[], popular: MediaSearchItem[]): MediaSearchItem[] {
  const mixed: MediaSearchItem[] = [];
  let t = 0;
  let p = 0;

  while (t < tailored.length || p < popular.length) {
    for (let i = 0; i < 2 && t < tailored.length; i += 1) {
      mixed.push(tailored[t]);
      t += 1;
    }
    if (p < popular.length) {
      mixed.push(popular[p]);
      p += 1;
    }
  }
  return mixed;
}

async function fetchTmdbPopular(type: "movie" | "tv", page: number, apiKey: string) {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/${type}?language=en-US&sort_by=popularity.desc&include_adult=false&vote_count.gte=50&page=${page}&api_key=${apiKey}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { items: [], hasMore: false };
  const data = (await res.json()) as TmdbDiscoverResponse;
  const items = (data.results ?? [])
    .map((item) => normalizeTmdbSearchItem({ ...item, media_type: type }))
    .filter((item) => !!item.posterUrl);
  const hasMore = typeof data.total_pages === "number" ? page < data.total_pages : false;
  return { items, hasMore };
}

async function fetchRawgPopular(page: number, apiKey: string) {
  const res = await fetch(
    `https://api.rawg.io/api/games?key=${apiKey}&ordering=-added&page_size=20&page=${page}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { items: [], hasMore: false };
  const data = (await res.json()) as RawgListResponse;
  const items = (data.results ?? []).map(normalizeRawgGame).filter((item) => !!item.posterUrl);
  return { items, hasMore: Boolean(data.next) };
}

async function fetchTmdbRecommendations(type: "movie" | "tv", externalId: string, apiKey: string) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${type}/${encodeURIComponent(externalId)}/recommendations?language=en-US&page=1&api_key=${apiKey}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as TmdbRecommendationsResponse;
  return (data.results ?? [])
    .map((item) => normalizeTmdbSearchItem({ ...item, media_type: type }))
    .filter((item) => !!item.posterUrl);
}

async function fetchRawgSuggestions(externalId: string, apiKey: string) {
  const res = await fetch(`https://api.rawg.io/api/games/${encodeURIComponent(externalId)}/suggested?key=${apiKey}&page_size=20`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as RawgListResponse;
  return (data.results ?? []).map(normalizeRawgGame).filter((item) => !!item.posterUrl);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as QuickAddType | null;
  const rawPage = Number(searchParams.get("page") || "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  if (type !== "movie" && type !== "tv" && type !== "game") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient().catch(() => null);
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const fullSelect = "source, media_type, external_id, status, rating, user_rating, updated_at";
  const legacySelect = "source, media_type, external_id, status, rating, updated_at";
  let collectionRows: CollectionRow[] = [];

  if (supabase && user) {
    const initial = await supabase.from("collection_entries").select(fullSelect).eq("user_id", user.id).limit(5000);
    if (initial.error) {
      const fallback = await supabase.from("collection_entries").select(legacySelect).eq("user_id", user.id).limit(5000);
      if (!fallback.error) {
        collectionRows = ((fallback.data ?? []) as CollectionRow[]).map((row) => ({ ...row, user_rating: null }));
      }
    } else {
      collectionRows = (initial.data ?? []) as CollectionRow[];
    }
  }

  const existingKeys = new Set(
    collectionRows.map((row) => toKey(row.source, row.media_type, row.external_id))
  );

  let popularItems: MediaSearchItem[] = [];
  let popularHasMore = false;

  if (type === "movie" || type === "tv") {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return NextResponse.json({ items: [], hasMore: false, page });
    const tmdb = await fetchTmdbPopular(type, page, apiKey);
    popularItems = tmdb.items;
    popularHasMore = tmdb.hasMore;
  } else {
    const apiKey = process.env.RAWG_API_KEY;
    if (!apiKey) return NextResponse.json({ items: [], hasMore: false, page });
    const rawg = await fetchRawgPopular(page, apiKey);
    popularItems = rawg.items;
    popularHasMore = rawg.hasMore;
  }

  const tailoredItems: MediaSearchItem[] = [];
  if (page === 1 && collectionRows.length > 0) {
    const seeds = collectionRows
      .filter((row) => row.media_type === type)
      .sort((a, b) => scoreSeed(b) - scoreSeed(a))
      .slice(0, 4);

    if (seeds.length > 0) {
      if ((type === "movie" || type === "tv") && process.env.TMDB_API_KEY) {
        const batches = await Promise.all(
          seeds
            .filter((row) => row.source === "tmdb")
            .map((row) => fetchTmdbRecommendations(type, row.external_id, process.env.TMDB_API_KEY as string))
        );
        for (const batch of batches) appendUnique(tailoredItems, batch);
      }
      if (type === "game" && process.env.RAWG_API_KEY) {
        const batches = await Promise.all(
          seeds
            .filter((row) => row.source === "rawg")
            .map((row) => fetchRawgSuggestions(row.external_id, process.env.RAWG_API_KEY as string))
        );
        for (const batch of batches) appendUnique(tailoredItems, batch);
      }
    }
  }

  const mixed = mixTailoredAndPopular(tailoredItems, popularItems);
  const filtered = mixed.filter((item) => !existingKeys.has(toKey(item.source, item.mediaType, item.externalId)));
  const pageSize = 20;
  const resultItems = filtered.slice(0, pageSize);
  const hasMore = popularHasMore || filtered.length > pageSize;

  return NextResponse.json({ items: resultItems, hasMore, page });
}
