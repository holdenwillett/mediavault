import { NextResponse } from "next/server";

type MediaType = "movie" | "tv";

type TmdbItem = {
  id: number;
  media_type: MediaType;
  popularity?: number;
  vote_count?: number;
  vote_average?: number;
  poster_path?: string | null;
  title?: string;
  name?: string;
  overview?: string;
};

type TmdbKeyword = {
  id: number;
};

type TmdbResponse<T> = {
  results?: T[];
};

const TMDB = "https://api.themoviedb.org/3";

async function tmdbGet(path: string, apiKey: string): Promise<unknown | null> {
  const url = `${TMDB}${path}${path.includes("?") ? "&" : "?"}api_key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function onlyMovieTv(items: unknown[] | undefined): TmdbItem[] {
  if (!items) return [];
  return (items as TmdbItem[]).filter((r) => r.media_type === "movie" || r.media_type === "tv");
}

function dedupe(items: TmdbItem[]): TmdbItem[] {
  const seen = new Set<string>();
  const out: TmdbItem[] = [];

  for (const item of items) {
    const key = `${item.media_type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function passesQuality(it: TmdbItem): boolean {
  const pop = it.popularity ?? 0;
  const votes = it.vote_count ?? 0;
  const hasPoster = !!it.poster_path;

  if (!hasPoster && pop < 15) return false;
  if (pop < 4 && votes < 50) return false;

  return true;
}

function score(it: TmdbItem, qLower: string): number {
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ top: [], related: [] });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is missing in .env.local" },
      { status: 500 }
    );
  }

  const qLower = q.toLowerCase();

  const multiPages = await Promise.all([
    tmdbGet(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`, apiKey),
    tmdbGet(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=2`, apiKey),
    tmdbGet(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=3`, apiKey),
  ]);

  const textMatches = multiPages
    .flatMap((page) => {
      const response = page as TmdbResponse<TmdbItem> | null;
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

  let keywordMatches: TmdbItem[] = [];

  if (keywordIds.length > 0) {
    const withKeywords = keywordIds.join(",");

    const [movieDiscover, tvDiscover] = await Promise.all([
      tmdbGet(
        `/discover/movie?with_keywords=${withKeywords}&sort_by=popularity.desc&include_adult=false&language=en-US&page=1`,
        apiKey
      ),
      tmdbGet(
        `/discover/tv?with_keywords=${withKeywords}&sort_by=popularity.desc&include_adult=false&language=en-US&page=1`,
        apiKey
      ),
    ]);

    const movieResults = ((movieDiscover as TmdbResponse<TmdbItem> | null)?.results ?? []).map((item) => ({
      ...item,
      media_type: "movie" as const,
    }));
    const tvResults = ((tvDiscover as TmdbResponse<TmdbItem> | null)?.results ?? []).map((item) => ({
      ...item,
      media_type: "tv" as const,
    }));

    keywordMatches = [...movieResults, ...tvResults].filter(passesQuality);
  }

  const combined = dedupe([...textMatches, ...keywordMatches]).sort(
    (a, b) => score(b, qLower) - score(a, qLower)
  );

  const top = combined.slice(0, 20);
  const topKeys = new Set(top.map((item) => `${item.media_type}:${item.id}`));
  const related = combined.filter((item) => !topKeys.has(`${item.media_type}:${item.id}`)).slice(0, 40);

  return NextResponse.json({ top, related });
}
