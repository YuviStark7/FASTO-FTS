"use server";
import { requireUser } from "@/lib/auth";
import type { Json } from "@/lib/database.types";
import { parsePassportInput, type PassportField } from "@/lib/passport/input";

export type SavePassportResult = { ok: true; id: number } | { ok: false; error: "invalid"; field: PassportField } | { ok: false; error: "forbidden" | "notFound" | "failed" };
export type DeletePassportResult = { ok: true } | { ok: false; error: "forbidden" | "failed" };

const validId = (id: unknown): id is number => typeof id === "number" && Number.isInteger(id) && id > 0;

/**
 * Creates (id null) or updates a product passport. Written with the user's own client: RLS refuses
 * viewers and other organisations. Fit is not stored: it is computed from the passport when read,
 * so a saved change shows on the next load, for this organisation only.
 */
export async function savePassport(id: unknown, input: unknown): Promise<SavePassportResult> {
  if (id !== null && !validId(id)) return { ok: false, error: "notFound" };
  const parsed = parsePassportInput(input);
  if (!parsed.ok) return { ok: false, error: "invalid", field: parsed.field };
  const v = parsed.value;

  const { supabase, userId } = await requireUser();
  const { data: category } = await supabase.from("categories").select("id").eq("id", v.categoryId).maybeSingle();
  if (!category) return { ok: false, error: "invalid", field: "category" };

  const columns = {
    name: v.name,
    category_id: v.categoryId,
    price_band: v.priceBand,
    certifications: v.certifications,
    format: v.format,
    capacity: v.capacity,
    story: v.story,
  };

  if (id === null) {
    const { data: mem } = await supabase.from("memberships").select("org_id, role, created_at").eq("user_id", userId).order("created_at", { ascending: true });
    const m = (mem ?? []).find((x) => x.role !== "viewer");
    if (!m) return { ok: false, error: "forbidden" };
    const { data, error } = await supabase
      .from("product_passports")
      .insert({ ...columns, org_id: m.org_id, attributes: { claims: v.claims } })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "failed" };
    return { ok: true, id: data.id };
  }

  // Keep whatever else lives in attributes; only the claims are ours to replace.
  const { data: existing } = await supabase.from("product_passports").select("attributes").eq("id", id).maybeSingle();
  if (!existing) return { ok: false, error: "notFound" };
  const kept = existing.attributes && typeof existing.attributes === "object" && !Array.isArray(existing.attributes) ? existing.attributes : {};
  const attributes: Json = { ...kept, claims: v.claims };
  const { data, error } = await supabase.from("product_passports").update({ ...columns, attributes }).eq("id", id).select("id");
  if (error) return { ok: false, error: "failed" };
  // RLS filters the row out of the update for a viewer: nothing is returned and nothing changed.
  if (!data?.length) return { ok: false, error: "forbidden" };
  return { ok: true, id };
}

export async function deletePassport(id: unknown): Promise<DeletePassportResult> {
  if (!validId(id)) return { ok: false, error: "failed" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("product_passports").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: "failed" };
  if (!data?.length) return { ok: false, error: "forbidden" };
  return { ok: true };
}
