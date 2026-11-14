"use server";
import { requireUser } from "@/lib/auth";
import { COMPONENTS, validWeights, type Weights } from "@/lib/scoring/mos";
import type { WeightSet } from "@/lib/queries/opportunities";

export type SaveWeightSetResult = { ok: true; set: WeightSet } | { ok: false; error: "name" | "weights" | "forbidden" | "failed" };

/**
 * Saves the what-if weights as a weight set of the user's organisation. Written with the user's own
 * client: RLS (`weight_sets_insert`) refuses viewers and other organisations, and the insert is audited.
 */
export async function saveWeightSet(name: unknown, weights: unknown): Promise<SaveWeightSetResult> {
  const clean = typeof name === "string" ? name.trim() : "";
  if (clean.length < 1 || clean.length > 80) return { ok: false, error: "name" };
  const w = (weights && typeof weights === "object" ? weights : {}) as Partial<Weights>;
  if (!validWeights(w)) return { ok: false, error: "weights" };
  // Only the five known keys reach the database.
  const stored = Object.fromEntries(COMPONENTS.map((k) => [k, w[k]])) as Weights;

  const { supabase, userId } = await requireUser();
  const { data: mem } = await supabase.from("memberships").select("org_id, role, created_at").eq("user_id", userId).order("created_at", { ascending: true });
  const m = (mem ?? []).find((x) => x.role !== "viewer");
  if (!m) return { ok: false, error: "forbidden" };

  const { data, error } = await supabase.from("weight_sets").insert({ org_id: m.org_id, name: clean, weights: stored }).select("id, name").single();
  if (error || !data) return { ok: false, error: "failed" };
  return { ok: true, set: { id: data.id, name: data.name, weights: stored } };
}
