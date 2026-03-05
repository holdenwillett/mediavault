import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/account?next=/profile&reason=session-expired");
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Profile</h1>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-300 hover:text-white">
              Home
            </Link>
            <Link href="/search" className="text-gray-300 hover:text-white">
              Search
            </Link>
            <Link href="/collections" className="text-gray-300 hover:text-white">
              Collections
            </Link>
            <Link href="/account" className="text-gray-300 hover:text-white">
              Account
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <div>
            <p className="text-sm text-zinc-400">Email</p>
            <p className="text-lg">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">User ID</p>
            <p className="text-sm break-all text-zinc-300">{user.id}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Created</p>
            <p className="text-sm text-zinc-300">{new Date(user.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
