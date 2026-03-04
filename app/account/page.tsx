"use client";

import Link from "next/link";
import { useState } from "react";
import { clearProfile, createAccount, getProfile, signIn } from "@/lib/account/storage";

type Mode = "signin" | "create";

export default function AccountPage() {
  const [, setRefresh] = useState(0);
  const profile = getProfile();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
          {profile ? (
            <>
              <p className="text-zinc-300">Signed in as</p>
              <p className="text-2xl font-semibold mt-1">{profile.name}</p>
              <button
                type="button"
                className="mt-4 px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800"
                onClick={() => {
                  clearProfile();
                  setPassword("");
                  setError(null);
                  setRefresh((v) => v + 1);
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  className={`px-3 py-1 rounded border ${mode === "signin" ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"}`}
                  onClick={() => setMode("signin")}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded border ${mode === "create" ? "bg-white text-black border-white" : "border-zinc-700 hover:bg-zinc-800"}`}
                  onClick={() => setMode("create")}
                >
                  Create Account
                </button>
              </div>

              <label className="block text-sm text-zinc-300 mb-2">Display name</label>
              <input
                className="w-full p-3 rounded bg-zinc-800 border border-zinc-700"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label className="block text-sm text-zinc-300 mb-2 mt-4">Password</label>
              <input
                className="w-full p-3 rounded bg-zinc-800 border border-zinc-700"
                placeholder="Enter password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="mt-4 px-4 py-2 rounded bg-white text-black hover:bg-zinc-200"
                onClick={() => {
                  setError(null);
                  const result = mode === "create" ? createAccount(name, password) : signIn(name, password);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setName(result.profile?.name ?? "");
                  setPassword("");
                  setRefresh((v) => v + 1);
                }}
              >
                {mode === "create" ? "Create Account" : "Sign In"}
              </button>

              {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
              <p className="mt-3 text-xs text-zinc-500">
                Password auth is currently local to this browser/device only.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
