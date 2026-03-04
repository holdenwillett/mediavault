import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <h1 className="text-6xl font-bold mb-4">MediaVault</h1>
      <p className="text-xl text-gray-400">
        Track your movies, shows, and games.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <Link href="/search" className="px-4 py-2 rounded bg-white text-black hover:bg-zinc-200">
          Search
        </Link>
        <Link href="/account" className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-900">
          Account
        </Link>
        <Link href="/collections" className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-900">
          Collections
        </Link>
        <Link href="/profile" className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-900">
          Profile
        </Link>
      </div>
    </main>
  );
}
