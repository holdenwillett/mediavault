import { NextResponse } from "next/server";
import type { CollectionStatus } from "@/lib/account/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CollectionInsertBody = {
  mediaType: "movie" | "tv" | "game";
  externalId: string | number;
  source: string;
  title: string;
  posterUrl?: string | null;
  rating?: number;
  status: CollectionStatus;
};

const VALID_STATUSES: CollectionStatus[] = ["wishlist", "in_progress", "completed"];

function toCompositeId(mediaType: string, externalId: string | number): string {
  return `${mediaType}:${String(externalId)}`;
}

function mapRow(row: Record<string, unknown>) {
  return {
    id: toCompositeId(String(row.media_type), String(row.external_id)),
    userId: String(row.user_id),
    mediaType: String(row.media_type),
    externalId: String(row.external_id),
    source: String(row.source),
    title: String(row.title),
    posterUrl: row.poster_url ? String(row.poster_url) : null,
    rating: typeof row.rating === "number" ? row.rating : undefined,
    status: String(row.status),
    addedAt: String(row.created_at),
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

export async function GET(req: Request) {
  const authed = await getAuthedUser().catch(() => null);
  if (!authed) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }
  const { supabase, user } = authed;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mediaType = searchParams.get("mediaType");
  const externalId = searchParams.get("externalId");

  let query = supabase
    .from("collection_entries")
    .select("user_id, media_type, external_id, source, title, poster_url, rating, status, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (mediaType) query = query.eq("media_type", mediaType);
  if (externalId) query = query.eq("external_id", externalId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: (data ?? []).map(mapRow) });
}

export async function POST(req: Request) {
  const authed = await getAuthedUser().catch(() => null);
  if (!authed) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }
  const { supabase, user } = authed;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as CollectionInsertBody;
  if (!body?.mediaType || !body?.externalId || !body?.source || !body?.title || !body?.status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    media_type: body.mediaType,
    external_id: String(body.externalId),
    source: body.source,
    title: body.title,
    poster_url: body.posterUrl ?? null,
    rating: body.rating ?? null,
    status: body.status,
  };

  const { data, error } = await supabase
    .from("collection_entries")
    .upsert(payload, { onConflict: "user_id,media_type,external_id" })
    .select("user_id, media_type, external_id, source, title, poster_url, rating, status, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: mapRow(data) });
}
