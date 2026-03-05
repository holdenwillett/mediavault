import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionControls } from "@/components/collection-controls";
import type { MediaSource } from "@/lib/media/types";

type MediaType = "movie" | "tv" | "game";

type TmdbDetails = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  number_of_seasons?: number;
  seasons?: {
    id: number;
    season_number: number;
    name?: string;
    air_date?: string;
    episode_count?: number;
  }[];
};

type TmdbSeasonDetails = {
  id: number;
  season_number: number;
  name?: string;
  air_date?: string;
  vote_average?: number;
  episodes?: {
    id: number;
    episode_number: number;
    name?: string;
    vote_average?: number;
    air_date?: string;
  }[];
};

type RawgDetails = {
  id: number;
  name?: string;
  description_raw?: string;
  background_image?: string | null;
  rating?: number;
  ratings_count?: number;
  released?: string;
  genres?: { id: number; name: string }[];
};

type DetailsView = {
  mediaType: MediaType;
  externalId: string;
  source: MediaSource;
  title: string;
  overview?: string;
  poster?: string | null;
  rating?: number;
  ratingCount?: number;
  date?: string;
  genres: { id: number; name: string }[];
  runtime?: number;
  seasons?: number;
  seasonDetails?: TmdbSeasonDetails[];
};

function isValidType(type: string): type is MediaType {
  return type === "movie" || type === "tv" || type === "game";
}

async function fetchTmdbDetails(type: "movie" | "tv", id: string): Promise<TmdbDetails | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&language=en-US`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

async function fetchTmdbSeasonDetails(tvId: string, seasonNumber: number): Promise<TmdbSeasonDetails | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${apiKey}&language=en-US`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;
  return res.json();
}

async function fetchRawgDetails(id: string): Promise<RawgDetails | null> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`https://api.rawg.io/api/games/${id}?key=${apiKey}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

async function fetchDetails(type: MediaType, id: string): Promise<DetailsView | null> {
  if (type === "movie" || type === "tv") {
    const data = await fetchTmdbDetails(type, id);
    if (!data) return null;

    let seasonDetails: TmdbSeasonDetails[] | undefined;
    if (type === "tv") {
      const seasons = (data.seasons ?? [])
        .filter((s) => s.season_number >= 0)
        .sort((a, b) => a.season_number - b.season_number);

      const seasonResponses = await Promise.all(
        seasons.map((season) => fetchTmdbSeasonDetails(id, season.season_number))
      );

      seasonDetails = seasonResponses
        .filter((s): s is TmdbSeasonDetails => Boolean(s))
        .sort((a, b) => a.season_number - b.season_number);
    }

    return {
      mediaType: type,
      externalId: id,
      source: "tmdb",
      title: data.title ?? data.name ?? "Untitled",
      overview: data.overview,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
      rating: data.vote_average,
      ratingCount: data.vote_count,
      date: type === "movie" ? data.release_date : data.first_air_date,
      genres: data.genres ?? [],
      runtime: data.runtime,
      seasons: data.number_of_seasons,
      seasonDetails,
    };
  }

  if (type === "game") {
    const game = await fetchRawgDetails(id);
    if (!game) return null;
    return {
      mediaType: "game",
      externalId: id,
      source: "rawg",
      title: game.name ?? "Untitled",
      overview: game.description_raw,
      poster: game.background_image ?? null,
      rating: typeof game.rating === "number" ? Math.min(game.rating * 2, 10) : undefined,
      ratingCount: game.ratings_count,
      date: game.released,
      genres: game.genres ?? [],
    };
  }

  return null;
}

export default async function MediaDetailsPage({
  params,
}: {
  params: Promise<{ type?: string; id?: string }>;
}) {
  const resolvedParams = await params;
  const type = resolvedParams.type;
  const id = resolvedParams.id;

  if (!type || !id) return notFound();
  if (!isValidType(type)) return notFound();

  const data = await fetchDetails(type, id);
  if (!data) return notFound();

  const year = data.date ? data.date.slice(0, 4) : "-";

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-gray-300 hover:text-white">
            Home
          </Link>
          <Link href="/search" className="text-gray-300 hover:text-white">
            {"<- Back to Search"}
          </Link>
        </div>

        <div className="mt-6 flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-72">
            <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
              {data.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.poster} alt={data.title} className="w-full h-auto" />
              ) : (
                <div className="aspect-[2/3] flex items-center justify-center text-gray-400">No poster</div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-4xl font-bold">
              {data.title} <span className="text-gray-400 font-normal">({year})</span>
            </h1>

            <div className="mt-2 text-sm text-gray-400">
              {type.toUpperCase()}
              {typeof data.rating === "number" ? ` | ${data.rating.toFixed(1)}/10` : ""}
              {typeof data.ratingCount === "number" ? ` | ${data.ratingCount.toLocaleString()} ratings` : ""}
              {type === "movie" && data.runtime ? ` | ${data.runtime} min` : ""}
              {type === "tv" && data.seasons ? ` | ${data.seasons} seasons` : ""}
            </div>

            <CollectionControls
              key={`${data.mediaType}:${data.externalId}`}
              mediaType={data.mediaType}
              externalId={data.externalId}
              source={data.source}
              title={data.title}
              posterUrl={data.poster}
              rating={data.rating}
            />

            {data.genres.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.genres.map((g) => (
                  <span
                    key={g.id}
                    className="text-xs px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-gray-300"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            ) : null}

            {data.overview ? <p className="mt-5 text-gray-200 leading-relaxed">{data.overview}</p> : null}

            {type === "tv" && data.seasonDetails?.length ? (
              <section className="mt-8">
                <h2 className="text-2xl font-semibold">Seasons & Episodes</h2>
                <div className="mt-4 space-y-3">
                  {data.seasonDetails.map((season) => (
                    <details key={season.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                      <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                        <div className="font-medium">
                          {season.name ?? `Season ${season.season_number}`}
                          {season.air_date ? (
                            <span className="text-zinc-400 font-normal"> ({season.air_date.slice(0, 4)})</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {typeof season.vote_average === "number" ? `\u2b50 ${season.vote_average.toFixed(1)}/10` : ""}
                          {season.episodes?.length ? ` | ${season.episodes.length} episodes` : ""}
                        </div>
                      </summary>

                      {season.episodes?.length ? (
                        <div className="mt-3 space-y-2">
                          {season.episodes.map((ep) => (
                            <div
                              key={ep.id}
                              className="text-sm rounded border border-zinc-800 bg-black/30 px-3 py-2 flex items-center justify-between gap-3"
                            >
                              <div>
                                <span className="text-zinc-400">E{ep.episode_number}: </span>
                                <span>{ep.name ?? "Untitled Episode"}</span>
                              </div>
                              <div className="text-xs text-zinc-400">
                                {typeof ep.vote_average === "number"
                                  ? `\u2b50 ${ep.vote_average.toFixed(1)}/10`
                                  : "No rating"}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </details>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
