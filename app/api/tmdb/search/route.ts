import { NextResponse } from "next/server";
import type { MediaSearchResponse } from "@/lib/media/types";
import { normalizeTmdbSearchItem, type TmdbSearchItem } from "@/lib/media/adapters/tmdb";

type TmdbKeyword = {
  id: number;
};

type TmdbResponse<T> = {
  results?: T[];
  total_pages?: number;
};

const TMDB = "https://api.themoviedb.org/3";

async function tmdbGet(path: string, apiKey: string): Promise<unknown | null> {
  const url = `${TMDB}${path}${path.includes("?") ? "&" : "?"}api_key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function onlyMovieTv(items: unknown[] | undefined): TmdbSearchItem[] {
  if (!items) return [];
  return (items as TmdbSearchItem[]).filter((r) => r.media_type === "movie" || r.media_type === "tv");
}

function dedupe(items: TmdbSearchItem[]): TmdbSearchItem[] {
  const seen = new Set<string>();
  const out: TmdbSearchItem[] = [];

  for (const item of items) {
    const key = `${item.media_type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function itemKey(item: TmdbSearchItem): string {
  return `${item.media_type}:${item.id}`;
}

function passesQuality(it: TmdbSearchItem): boolean {
  const pop = it.popularity ?? 0;
  const votes = it.vote_count ?? 0;
  const hasPoster = !!it.poster_path;

  if (!hasPoster && pop < 15) return false;
  if (pop < 4 && votes < 50) return false;

  return true;
}

function score(it: TmdbSearchItem, qLower: string): number {
  const title = (it.title ?? it.name ?? "").toLowerCase();
  const overview = (it.overview ?? "").toLowerCase();
  const pop = it.popularity ?? 0;
  const votes = it.vote_count ?? 0;

  let s = 0;

  // Relevance still matters, but popularity is weighted heavily.
  if (title === qLower) s += 700;
  else if (title.startsWith(qLower)) s += 450;
  else if (title.includes(qLower)) s += 280;
  if (overview.includes(qLower)) s += 50;
  if (it.media_type === "movie") s += 50;

  // Big, popular titles should rise above random low-signal matches.
  s += Math.log10(pop + 1) * 700;
  s += Math.log10(votes + 1) * 220;

  return s;
}

function isQueryRelevant(it: TmdbSearchItem, qLower: string): boolean {
  const title = (it.title ?? it.name ?? "").toLowerCase();
  const overview = (it.overview ?? "").toLowerCase();
  return title.includes(qLower) || overview.includes(qLower);
}

async function fetchSeedRecommendations(seed: TmdbSearchItem, apiKey: string): Promise<TmdbSearchItem[]> {
  const [recommendationsPage1Response, recommendationsPage2Response, similarResponse] = (await Promise.all([
    tmdbGet(`/${seed.media_type}/${seed.id}/recommendations?language=en-US&page=1`, apiKey),
    tmdbGet(`/${seed.media_type}/${seed.id}/recommendations?language=en-US&page=2`, apiKey),
    tmdbGet(`/${seed.media_type}/${seed.id}/similar?language=en-US&page=1`, apiKey),
  ])) as [TmdbResponse<TmdbSearchItem> | null, TmdbResponse<TmdbSearchItem> | null, TmdbResponse<TmdbSearchItem> | null];

  const recommendationsPage1 = (recommendationsPage1Response?.results ?? []).map((item) => ({
    ...item,
    media_type: seed.media_type,
  }));
  const recommendationsPage2 = (recommendationsPage2Response?.results ?? []).map((item) => ({
    ...item,
    media_type: seed.media_type,
  }));
  const similar = (similarResponse?.results ?? []).map((item) => ({
    ...item,
    media_type: seed.media_type,
  }));

  return [...recommendationsPage1, ...recommendationsPage2, ...similar];
}

function titleHasQuery(it: TmdbSearchItem, qLower: string): boolean {
  const title = (it.title ?? it.name ?? "").toLowerCase();
  return title.includes(qLower);
}

function pickSeedItems(items: TmdbSearchItem[], qLower: string): TmdbSearchItem[] {
  const withQueryTitle = dedupe(items).filter((item) => titleHasQuery(item, qLower));
  const movies = withQueryTitle.filter((item) => item.media_type === "movie");
  const tv = withQueryTitle.filter((item) => item.media_type === "tv");

  // Prioritize movies first so movie franchises are expanded reliably.
  return [...movies.slice(0, 3), ...tv.slice(0, 1)].slice(0, 4);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const rawPage = Number(searchParams.get("page") || "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  if (q.length < 2) {
    const empty: MediaSearchResponse = { top: [], related: [], page, hasMore: false };
    return NextResponse.json(empty);
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    const error: MediaSearchResponse = {
      top: [],
      related: [],
      page,
      hasMore: false,
      error: "TMDB_API_KEY is missing in .env.local",
    };
    return NextResponse.json(error, { status: 500 });
  }

  const qLower = q.toLowerCase();

  const multiPages = await Promise.all(
    (page === 1 ? [1, 2, 3] : [page, page + 1]).map((p) =>
      tmdbGet(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=${p}`, apiKey)
    )
  );

  const textMatches = multiPages
    .flatMap((page) => {
      const response = page as TmdbResponse<TmdbSearchItem> | null;
      return onlyMovieTv(response?.results);
    })
    .filter(passesQuality);

  const keywordsResponse = (await tmdbGet(
    `/search/keyword?query=${encodeURIComponent(q)}&page=1`,
    apiKey
  )) as TmdbResponse<TmdbKeyword> | null;

  const keywordIds = (keywordsResponse?.results ?? [])
    .slice(0, 5)
    .map((k) => k.id)
    .filter(Boolean);

  let keywordMatches: TmdbSearchItem[] = [];

  if (keywordIds.length > 0) {
    const withKeywords = keywordIds.join(",");

    const [movieDiscover, tvDiscover] = await Promise.all([
      tmdbGet(
        `/discover/movie?with_keywords=${withKeywords}&sort_by=popularity.desc&include_adult=false&language=en-US&page=${page}`,
        apiKey
      ),
      tmdbGet(
        `/discover/tv?with_keywords=${withKeywords}&sort_by=popularity.desc&include_adult=false&language=en-US&page=${page}`,
        apiKey
      ),
    ]);

    const movieResults = ((movieDiscover as TmdbResponse<TmdbSearchItem> | null)?.results ?? []).map((item) => ({
      ...item,
      media_type: "movie" as const,
    }));
    const tvResults = ((tvDiscover as TmdbResponse<TmdbSearchItem> | null)?.results ?? []).map((item) => ({
      ...item,
      media_type: "tv" as const,
    }));

    keywordMatches = [...movieResults, ...tvResults].filter(passesQuality);
  }

  // Pull recommendation-based franchise results from top seeds on page 1.
  let recommendationMatches: TmdbSearchItem[] = [];
  const recommendationStrength = new Map<string, number>();
  if (page === 1) {
    const seeds = pickSeedItems(
      [...textMatches, ...keywordMatches].sort((a, b) => score(b, qLower) - score(a, qLower)),
      qLower
    );
    const recBatches = await Promise.all(seeds.map((seed) => fetchSeedRecommendations(seed, apiKey)));
    const recRaw = recBatches.flat().filter(passesQuality);
    for (const item of recRaw) {
      const key = itemKey(item);
      recommendationStrength.set(key, (recommendationStrength.get(key) ?? 0) + 1);
    }
    recommendationMatches = dedupe(recRaw);
  }

  const rank = (item: TmdbSearchItem) =>
    score(item, qLower) + (recommendationStrength.get(itemKey(item)) ?? 0) * 400;

  const combined = dedupe([...textMatches, ...keywordMatches, ...recommendationMatches]).sort(
    (a, b) => rank(b) - rank(a)
  );

  // Keep "Top matches" strictly relevant to the query.
  const relevant = combined.filter((item) => isQueryRelevant(item, qLower));
  const nonRelevant = combined.filter((item) => !isQueryRelevant(item, qLower));

  const top = relevant.slice(0, 20);
  const recommendationKeys = new Set(recommendationMatches.map(itemKey));
  const recommendationRelated = nonRelevant.filter((item) => recommendationKeys.has(itemKey(item)));
  const remainingRelated = nonRelevant.filter((item) => !recommendationKeys.has(itemKey(item)));
  const related = dedupe([...relevant.slice(20), ...recommendationRelated, ...remainingRelated]).slice(0, 40);
  const hasMore = combined.length > 20 || textMatches.length > 0 || keywordMatches.length > 0;

  const response: MediaSearchResponse = {
    top: top.map(normalizeTmdbSearchItem),
    related: related.map(normalizeTmdbSearchItem),
    page,
    hasMore,
  };

  return NextResponse.json(response);
}
