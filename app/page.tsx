import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[url('/home-bg.svg')] bg-cover bg-center" aria-hidden="true" />
      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" aria-hidden="true" />

      <div className="relative z-10 px-6 text-center">
        <h1
          className="mb-4 text-6xl font-black uppercase tracking-[0.06em] sm:text-7xl"
          style={{
            color: "#ffffff",
            fontFamily: '"Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif',
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          Media-Vault
        </h1>
        <p className="text-lg sm:text-xl text-gray-200">Track your movies, shows, and games.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link href="/search" className="px-4 py-2 rounded bg-white text-black hover:bg-zinc-200">
            Search
          </Link>
          <Link href="/account" className="px-4 py-2 rounded border border-zinc-500 bg-black/40 hover:bg-zinc-900">
            Account
          </Link>
          <Link href="/collections" className="px-4 py-2 rounded border border-zinc-500 bg-black/40 hover:bg-zinc-900">
            Collections
          </Link>
          <Link href="/profile" className="px-4 py-2 rounded border border-zinc-500 bg-black/40 hover:bg-zinc-900">
            Profile
          </Link>
        </div>
      </div>
    </main>
  );
}
