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

function validateUserRating(userRating: unknown): number | null {
  if (userRating === null || typeof userRating === "undefined" || userRating === "") return null;
  if (typeof userRating !== "number" || Number.isNaN(userRating)) throw new Error("Invalid user rating");
  if (userRating < 0 || userRating > 10) throw new Error("User rating must be between 0 and 10");
  return Number(userRating.toFixed(1));
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const authed = await getAuthed().catch(() => null);
  if (!authed) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const { supabase, user } = authed;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const parsed = parseCompositeId(decodeURIComponent(id));
  if (!parsed) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = (await req.json()) as {
    status?: CollectionStatus;
    userRating?: number | null;
    listId?: string | null;
  };

  const updates: Record<string, unknown> = {};

  if (typeof body.status !== "undefined") {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (typeof body.userRating !== "undefined") {
    try {
      updates.user_rating = validateUserRating(body.userRating);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid user rating" }, { status: 400 });
    }
  }

  if (typeof body.listId !== "undefined") {
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
    updates.list_id = body.listId ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { error } = await supabase
    .from("collection_entries")
    .update(updates)
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
