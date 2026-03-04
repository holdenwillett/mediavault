import { NextResponse } from "next/server";
import type { CollectionStatus } from "@/lib/account/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_STATUSES: CollectionStatus[] = ["wishlist", "in_progress", "completed"];

function parseCompositeId(id: string): { mediaType: string; externalId: string } | null {
  const idx = id.indexOf(":");
  if (idx <= 0 || idx === id.length - 1) return null;
  return {
    mediaType: id.slice(0, idx),
    externalId: id.slice(idx + 1),
  };
}

async function getAuthed() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const authed = await getAuthed().catch(() => null);
  if (!authed) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const { supabase, user } = authed;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const parsed = parseCompositeId(decodeURIComponent(id));
  if (!parsed) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = (await req.json()) as { status?: CollectionStatus };
  if (!body?.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("collection_entries")
    .update({ status: body.status })
    .eq("user_id", user.id)
    .eq("media_type", parsed.mediaType)
    .eq("external_id", parsed.externalId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const authed = await getAuthed().catch(() => null);
  if (!authed) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const { supabase, user } = authed;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const parsed = parseCompositeId(decodeURIComponent(id));
  if (!parsed) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await supabase
    .from("collection_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("media_type", parsed.mediaType)
    .eq("external_id", parsed.externalId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
