import Link from "next/link";
import { notFound } from "next/navigation";

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
  title: string;
  overview?: string;
  poster?: string | null;
  rating?: number;
  ratingCount?: number;
  date?: string;
  genres: { id: number; name: string }[];
  runtime?: number;
  seasons?: number;
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

    return {
      title: data.title ?? data.name ?? "Untitled",
      overview: data.overview,
      poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
      rating: data.vote_average,
      ratingCount: data.vote_count,
      date: type === "movie" ? data.release_date : data.first_air_date,
      genres: data.genres ?? [],
      runtime: data.runtime,
      seasons: data.number_of_seasons,
    };
  }

  const game = await fetchRawgDetails(id);
  if (!game) return null;

  return {
    title: game.name ?? "Untitled",
    overview: game.description_raw,
    poster: game.background_image ?? null,
    rating: typeof game.rating === "number" ? Math.min(game.rating * 2, 10) : undefined,
    ratingCount: game.ratings_count,
    date: game.released,
    genres: game.genres ?? [],
  };
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
        <Link href="/search" className="text-gray-300 hover:text-white">
          {"<- Back to Search"}
        </Link>

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
          </div>
        </div>
      </div>
    </main>
  );
}
