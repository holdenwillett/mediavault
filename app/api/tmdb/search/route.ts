import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is missing in .env.local" },
      { status: 500 }
    );
  }

  const url =
    "https://api.themoviedb.org/3/search/multi?" +
    new URLSearchParams({
      api_key: apiKey,
      query,
      include_adult: "false",
      language: "en-US",
      page: "1",
    });

  const res = await fetch(url);
  const data = await res.json();

  const filtered = (data.results ?? []).filter(
    (r: any) => r.media_type === "movie" || r.media_type === "tv"
  );

  return NextResponse.json({ results: filtered });
}