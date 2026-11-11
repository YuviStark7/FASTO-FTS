"use server";
import { revalidatePath } from "next/cache";
import { getStaffRole } from "@/lib/admin";
import { dispatchQueuedRuns } from "@/lib/pipelines/dispatch";
import { CONNECTORS } from "@/pipelines/connectors";

export type RerunResult = { ok: true; mode: "dispatched" | "scheduled" } | { ok: false };

/** Queue a run with the user's own client: RLS decides who may. Never the service-role client. */
export async function rerunSource(sourceId: number): Promise<RerunResult> {
  const { supabase, role } = await getStaffRole();
  if (!role) return { ok: false };
  const { data: source } = await supabase.from("sources").select("slug").eq("id", sourceId).maybeSingle();
  if (!source || !(CONNECTORS as readonly string[]).includes(source.slug)) return { ok: false };
  const { data: open } = await supabase.from("source_runs").select("id").eq("source_id", sourceId).in("status", ["queued", "running"]).limit(1);
  if (open?.length) return { ok: false };
  const { error } = await supabase.from("source_runs").insert({ source_id: sourceId });
  if (error) return { ok: false };
  const mode = await dispatchQueuedRuns().catch(() => "scheduled" as const);
  revalidatePath("/", "layout");
  return { ok: true, mode };
}

/** Admin only, enforced by RLS: a non-admin update changes zero rows. */
export async function setSourceActive(sourceId: number, active: boolean): Promise<{ ok: boolean }> {
  const { supabase } = await getStaffRole();
  const { data, error } = await supabase.from("sources").update({ is_active: active }).eq("id", sourceId).select("id");
  if (error || !data?.length) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}
