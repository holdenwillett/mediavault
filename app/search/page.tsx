"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Media = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type: "movie" | "tv";
  vote_average: number;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Media[]>([]);

  useEffect(() => {
    if (query.length < 2) return;

    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results);
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Search Media</h1>

      <input
        className="w-full p-3 text-black rounded mb-6"
        placeholder="Search movies or TV..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid grid-cols-5 gap-6">
        {results.map((item) => (
          <Link key={item.id} href={`/${item.media_type}/${item.id}`}>
            <div className="bg-gray-900 p-2 rounded hover:scale-105 transition cursor-pointer">
              {item.poster_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                  className="rounded"
                  alt={item.title || item.name || "Poster"}
                />
              )}

              <p className="mt-2 text-sm">{item.title || item.name}</p>

              <p className="text-xs text-gray-400">⭐ {item.vote_average}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}