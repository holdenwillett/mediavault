import { NextResponse } from "next/server";
import type { MediaSearchResponse } from "@/lib/media/types";
import { normalizeRawgGame, type RawgGame } from "@/lib/media/adapters/rawg";

type RawgSearchResponse = {
  results?: RawgGame[];
  next?: string | null;
};

const RAWG = "https://api.rawg.io/api";

function passesQuality(game: RawgGame): boolean {
  const hasPoster = Boolean(game.background_image);
  const added = game.added ?? 0;
  const ratingsCount = game.ratings_count ?? 0;
  const rating = game.rating ?? 0;

  if (!hasPoster) return false;
  if (ratingsCount < 40 && added < 500) return false;
  if (rating > 0 && rating < 2.5 && ratingsCount < 200) return false;

  return true;
}

function score(game: RawgGame, qLower: string): number {
  const title = (game.name ?? "").toLowerCase();
  const added = game.added ?? 0;
  const ratingsCount = game.ratings_count ?? 0;
  const rating10 = (game.rating ?? 0) * 2;

  let s = 0;
  if (title === qLower) s += 1200;
  else if (title.startsWith(qLower)) s += 800;
  else if (title.includes(qLower)) s += 450;

  // Prefer strong community-vetted results over obscure matches.
  s += Math.log10(ratingsCount + 1) * 260;
  s += rating10 * 45;
  s += Math.log10(added + 1) * 90;
  return s;
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

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    // Optional integration: no key means silently return no game results.
    const empty: MediaSearchResponse = { top: [], related: [], page, hasMore: false };
    return NextResponse.json(empty);
  }

  const url =
    `${RAWG}/games?` +
    new URLSearchParams({
      key: apiKey,
      search: q,
      search_precise: "true",
      ordering: "-rating,-ratings_count,-added",
      page: String(page),
      page_size: "30",
    });

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const error: MediaSearchResponse = {
      top: [],
      related: [],
      page,
      hasMore: false,
      error: "Games search failed",
    };
    return NextResponse.json(error, { status: 500 });
  }

  const data = (await res.json()) as RawgSearchResponse;
  const qLower = q.toLowerCase();
  const scored = (data.results ?? [])
    .filter(passesQuality)
    .sort((a, b) => score(b, qLower) - score(a, qLower));

  const top = scored.slice(0, 10).map(normalizeRawgGame);
  const related = scored.slice(10, 30).map(normalizeRawgGame);

  const response: MediaSearchResponse = {
    top,
    related,
    page,
    hasMore: Boolean(data.next),
  };

  return NextResponse.json(response);
}
