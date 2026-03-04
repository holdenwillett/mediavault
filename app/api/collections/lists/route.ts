import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ListInsertBody = {
  name?: string;
};

function mapListRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function getAuthedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const authed = await getAuthedUser().catch(() => null);
  if (!authed) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }
  const { supabase, user } = authed;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("collection_lists")
    .select("id, user_id, name, created_at, updated_at")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lists: (data ?? []).map(mapListRow) });
}

export async function POST(req: Request) {
  const authed = await getAuthedUser().catch(() => null);
  if (!authed) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }
  const { supabase, user } = authed;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as ListInsertBody;
  const rawName = body?.name ?? "";
  const name = rawName.trim();
  if (!name) return NextResponse.json({ error: "List name is required" }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "List name must be 60 chars or fewer" }, { status: 400 });

  const { data, error } = await supabase
    .from("collection_lists")
    .insert({
      user_id: user.id,
      name,
    })
    .select("id, user_id, name, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "List already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ list: mapListRow(data) }, { status: 201 });
}
