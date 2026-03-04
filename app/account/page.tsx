"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "signin" | "create";

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next"));
    setReason(params.get("reason"));
  }, []);

  useEffect(() => {
    if (!user || !nextPath) return;
    if (!nextPath.startsWith("/")) return;
    router.replace(nextPath);
  }, [nextPath, router, user]);

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
            <Link href="/profile" className="text-gray-300 hover:text-white">
              Profile
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          {reason === "session-expired" && !user ? (
            <p className="text-sm text-amber-300 mb-3">Your session expired. Sign in again to continue.</p>
          ) : null}

          {!supabase ? (
            <p className="text-sm text-red-400">
              Supabase is not configured. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to
              `.env.local`.
            </p>
          ) : null}

          {supabase && user ? (
            <>
              <p className="text-zinc-300">Signed in as</p>
              <p className="text-2xl font-semibold mt-1">{user.email}</p>
              <button
                type="button"
                className="mt-4 px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800"
                onClick={async () => {
                  setError(null);
                  setNotice(null);
                  await supabase.auth.signOut();
                }}
              >
                Sign Out
              </button>
            </>
          ) : supabase ? (
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

              <label className="block text-sm text-zinc-300 mb-2">Email</label>
              <input
                className="w-full p-3 rounded bg-zinc-800 border border-zinc-700"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                className="mt-4 px-4 py-2 rounded bg-white text-black hover:bg-zinc-200 disabled:opacity-50"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  setNotice(null);
                  try {
                    if (mode === "create") {
                      const emailRedirectTo =
                        typeof window !== "undefined" ? `${window.location.origin}/account` : undefined;
                      const { error: signUpError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: { emailRedirectTo },
                      });
                      if (signUpError) {
                        setError(signUpError.message);
                        return;
                      }
                      setNotice("Account created. Check your email if confirmation is required.");
                    } else {
                      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                      if (signInError) {
                        setError(signInError.message);
                        return;
                      }
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? "Please wait..." : mode === "create" ? "Create Account" : "Sign In"}
              </button>

              {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
              {notice ? <p className="mt-3 text-sm text-emerald-400">{notice}</p> : null}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
