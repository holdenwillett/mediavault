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
  userRating?: number | null;
  status: CollectionStatus;
  listId?: string | null;
};

const VALID_STATUSES: CollectionStatus[] = ["wishlist", "in_progress", "completed"];

function toCompositeId(mediaType: string, externalId: string | number): string {
  return `${mediaType}:${String(externalId)}`;
}

function mapRow(row: Record<string, unknown>) {
  const listData = row.collection_lists as { name?: unknown } | { name?: unknown }[] | null;
  const listName = Array.isArray(listData)
    ? (listData[0]?.name as string | undefined)
    : (listData?.name as string | undefined);

  return {
    id: toCompositeId(String(row.media_type), String(row.external_id)),
    userId: String(row.user_id),
    mediaType: String(row.media_type),
    externalId: String(row.external_id),
    source: String(row.source),
    title: String(row.title),
    posterUrl: row.poster_url ? String(row.poster_url) : null,
    rating: typeof row.rating === "number" ? row.rating : undefined,
    userRating: typeof row.user_rating === "number" ? row.user_rating : null,
    status: String(row.status),
    listId: row.list_id ? String(row.list_id) : null,
    listName: listName ?? null,
    addedAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function validateUserRating(userRating: unknown): number | null {
  if (userRating === null || typeof userRating === "undefined" || userRating === "") return null;
  if (typeof userRating !== "number" || Number.isNaN(userRating)) throw new Error("Invalid user rating");
  if (userRating < 0 || userRating > 10) throw new Error("User rating must be between 0 and 10");
  return Number(userRating.toFixed(1));
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
    .select(
      "user_id, media_type, external_id, source, title, poster_url, rating, user_rating, status, list_id, created_at, updated_at, collection_lists(name)"
    )
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
  if (body.listId && typeof body.listId !== "string") {
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });
  }
  if (body.listId) {
    const { data: listRow, error: listError } = await supabase
      .from("collection_lists")
      .select("id")
      .eq("id", body.listId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
    if (!listRow) return NextResponse.json({ error: "List not found" }, { status: 400 });
  }

  let userRating: number | null;
  try {
    userRating = validateUserRating(body.userRating);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid user rating" }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    media_type: body.mediaType,
    external_id: String(body.externalId),
    source: body.source,
    title: body.title,
    poster_url: body.posterUrl ?? null,
    rating: body.rating ?? null,
    user_rating: userRating,
    status: body.status,
    list_id: body.listId ?? null,
  };

  const { data, error } = await supabase
    .from("collection_entries")
    .upsert(payload, { onConflict: "user_id,media_type,external_id" })
    .select(
      "user_id, media_type, external_id, source, title, poster_url, rating, user_rating, status, list_id, created_at, updated_at, collection_lists(name)"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: mapRow(data) });
}
