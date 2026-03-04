import Link from "next/link";
import { notFound } from "next/navigation";

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

function isValidType(type: string) {
  return type === "movie" || type === "tv";
}

async function fetchDetails(type: string, id: string): Promise<TmdbDetails | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&language=en-US`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;
  return res.json();
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

  const title = data.title ?? data.name ?? "Untitled";
  const date = type === "movie" ? data.release_date : data.first_air_date;
  const year = date ? date.slice(0, 4) : "—";
  const poster = data.poster_path
    ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
    : null;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/search" className="text-gray-300 hover:text-white">
          ← Back to Search
        </Link>

        <div className="mt-6 flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-72">
            <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={title} className="w-full h-auto" />
              ) : (
                <div className="aspect-[2/3] flex items-center justify-center text-gray-400">
                  No poster
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-4xl font-bold">
              {title} <span className="text-gray-400 font-normal">({year})</span>
            </h1>

            <div className="mt-2 text-sm text-gray-400">
              {type.toUpperCase()}
              {typeof data.vote_average === "number" ? ` • ⭐ ${data.vote_average.toFixed(1)}` : ""}
              {typeof data.vote_count === "number" ? ` • ${data.vote_count.toLocaleString()} votes` : ""}
              {type === "movie" && data.runtime ? ` • ${data.runtime} min` : ""}
              {type === "tv" && data.number_of_seasons ? ` • ${data.number_of_seasons} seasons` : ""}
            </div>

            {data.genres?.length ? (
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

            {data.overview ? (
              <p className="mt-5 text-gray-200 leading-relaxed">{data.overview}</p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
