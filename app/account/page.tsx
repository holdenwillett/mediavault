"use client";

import Link from "next/link";
import { useState } from "react";
import { clearProfile, getProfile, saveProfile } from "@/lib/account/storage";

export default function AccountPage() {
  const [, setRefresh] = useState(0);
  const profile = getProfile();
  const currentName = profile?.name ?? null;
  const [name, setName] = useState(() => profile?.name ?? "");

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Account</h1>
          <div className="flex items-center gap-4">
            <Link href="/search" className="text-gray-300 hover:text-white">
              Search
            </Link>
            <Link href="/collections" className="text-gray-300 hover:text-white">
              Collections
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <label className="block text-sm text-zinc-300 mb-2">Display name</label>
          <input
            className="w-full p-3 rounded bg-zinc-800 border border-zinc-700"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded bg-white text-black hover:bg-zinc-200"
              onClick={() => {
                const next = saveProfile(name);
                if (next) {
                  setName(next.name);
                  setRefresh((v) => v + 1);
                }
              }}
            >
              Save Account
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800"
              onClick={() => {
                clearProfile();
                setName("");
                setRefresh((v) => v + 1);
              }}
            >
              Sign Out
            </button>
          </div>

          <p className="mt-4 text-sm text-zinc-400">
            {currentName ? `Signed in as ${currentName}` : "No account yet. Create one to track your collection."}
          </p>
        </div>
      </div>
    </main>
  );
}
