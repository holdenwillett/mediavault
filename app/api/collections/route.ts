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
const FULL_SELECT =
  "user_id, media_type, external_id, source, title, poster_url, rating, user_rating, status, list_id, created_at, updated_at";
const LEGACY_SELECT = "user_id, media_type, external_id, source, title, poster_url, rating, status, created_at, updated_at";

function isSchemaMismatchError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "42P01" || error.code === "PGRST200") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find a relationship between") ||
    msg.includes("schema cache")
  );
}

function toCompositeId(mediaType: string, externalId: string | number): string {
  return `${mediaType}:${String(externalId)}`;
}

function mapRow(row: Record<string, unknown>, listNameMap?: Map<string, string>) {
  const rawStatus = String(row.status);
  const status = VALID_STATUSES.includes(rawStatus as CollectionStatus)
    ? (rawStatus as CollectionStatus)
    : "wishlist";
  const rawRating = row.rating;
  const rating =
    typeof rawRating === "number"
      ? rawRating
      : typeof rawRating === "string"
      ? Number.parseFloat(rawRating)
      : Number.NaN;
  const rawUserRating = row.user_rating;
  const userRating =
    typeof rawUserRating === "number"
      ? rawUserRating
      : typeof rawUserRating === "string"
      ? Number.parseFloat(rawUserRating)
      : Number.NaN;
  const listId = row.list_id ? String(row.list_id) : null;
  return {
    id: toCompositeId(String(row.media_type), String(row.external_id)),
    userId: String(row.user_id),
    mediaType: String(row.media_type),
    externalId: String(row.external_id),
    source: String(row.source),
    title: String(row.title),
    posterUrl: row.poster_url ? String(row.poster_url) : null,
    rating: Number.isFinite(rating) ? rating : undefined,
    userRating: Number.isFinite(userRating) ? userRating : null,
    status,
    listId,
    listName: listId ? (listNameMap?.get(listId) ?? null) : null,
    addedAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function fetchListNameMap(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  listIds: string[]
) {
  if (!listIds.length) return new Map<string, string>();

  const { data, error } = await supabase.from("collection_lists").select("id, name").eq("user_id", userId).in("id", listIds);

  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.id && row.name) map.set(String(row.id), String(row.name));
  }
  return map;
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

  let query = supabase.from("collection_entries").select(FULL_SELECT).eq("user_id", user.id).order("updated_at", { ascending: false });

  if (mediaType) query = query.eq("media_type", mediaType);
  if (externalId) query = query.eq("external_id", externalId);

  const initial = await query;
  let rows = ((initial.data ?? []) as unknown[]).map((row) => row as Record<string, unknown>);
  let queryError = initial.error;
  if (queryError) {
    let fallbackQuery = supabase
      .from("collection_entries")
      .select(LEGACY_SELECT)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (mediaType) fallbackQuery = fallbackQuery.eq("media_type", mediaType);
    if (externalId) fallbackQuery = fallbackQuery.eq("external_id", externalId);
    const fallback = await fallbackQuery;
    if (!fallback.error) {
      rows = ((fallback.data ?? []) as unknown[]).map((row) => row as Record<string, unknown>);
      queryError = null;
    }
  }
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  const listIds = Array.from(
    new Set(rows.map((row) => row.list_id).filter((id): id is string | number => Boolean(id)).map((id) => String(id)))
  );
  const listNameMap = await fetchListNameMap(supabase, user.id, listIds).catch(() => new Map<string, string>());

  return NextResponse.json({ items: rows.map((row) => mapRow(row, listNameMap)) });
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
    if (listError && isSchemaMismatchError(listError)) {
      return NextResponse.json({ error: "List folders are not enabled yet. Run the latest Supabase schema SQL." }, { status: 503 });
    }
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

  const initialUpsert = await supabase
    .from("collection_entries")
    .upsert(payload, { onConflict: "user_id,media_type,external_id" })
    .select(FULL_SELECT)
    .single();
  let upsertRow = (initialUpsert.data ?? null) as Record<string, unknown> | null;
  let upsertError = initialUpsert.error;

  if (upsertError) {
    const legacyPayload = {
      user_id: user.id,
      media_type: body.mediaType,
      external_id: String(body.externalId),
      source: body.source,
      title: body.title,
      poster_url: body.posterUrl ?? null,
      rating: body.rating ?? null,
      status: body.status,
    };
    const fallback = await supabase
      .from("collection_entries")
      .upsert(legacyPayload, { onConflict: "user_id,media_type,external_id" })
      .select(LEGACY_SELECT)
      .single();
    if (!fallback.error) {
      upsertRow = (fallback.data ?? null) as Record<string, unknown> | null;
      upsertError = null;
    }
  }

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  if (!upsertRow) return NextResponse.json({ error: "Could not save this item." }, { status: 500 });
  const row = upsertRow;
  const listId = row.list_id ? String(row.list_id) : null;
  const listNameMap =
    listId === null ? new Map<string, string>() : await fetchListNameMap(supabase, user.id, [listId]).catch(() => new Map<string, string>());
  return NextResponse.json({ item: mapRow(row, listNameMap) });
}
