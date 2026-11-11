"use server";
import { requireUser } from "@/lib/auth";

export type FeedbackTarget = "brief_version" | "csi_snapshot";
export type Rating = "right" | "partly_right" | "wrong";
const RATINGS: readonly string[] = ["right", "partly_right", "wrong"];
const TARGETS: readonly string[] = ["brief_version", "csi_snapshot"];

export type MyFeedback = { canWrite: boolean; rating: Rating | null; comment: string };

/** The user's own rating and whether their role may write. All reads go through RLS. */
export async function getMyFeedback(targetType: FeedbackTarget, targetId: number): Promise<MyFeedback> {
  const { supabase, userId } = await requireUser();
  const [{ data: mem }, { data: fb }] = await Promise.all([
    supabase.from("memberships").select("role").eq("user_id", userId),
    supabase.from("feedback").select("rating, comment").eq("user_id", userId).eq("target_type", targetType).eq("target_id", targetId).maybeSingle(),
  ]);
  return {
    canWrite: (mem ?? []).some((m) => m.role !== "viewer"),
    rating: (fb?.rating as Rating | undefined) ?? null,
    comment: fb?.comment ?? "",
  };
}

/** Upsert on (user_id, target_type, target_id) with the user's own client: RLS refuses viewers. */
export async function saveFeedback(targetType: FeedbackTarget, targetId: number, rating: Rating, comment: string): Promise<{ ok: boolean }> {
  if (!TARGETS.includes(targetType) || !RATINGS.includes(rating) || !Number.isInteger(targetId) || comment.length > 2000) return { ok: false };
  const { supabase, userId } = await requireUser();
  const { data: mem } = await supabase.from("memberships").select("org_id, role, created_at").eq("user_id", userId).order("created_at", { ascending: true });
  const m = (mem ?? []).find((x) => x.role !== "viewer");
  if (!m) return { ok: false };
  const { error } = await supabase.from("feedback").upsert(
    { org_id: m.org_id, user_id: userId, target_type: targetType, target_id: targetId, rating, comment: comment.trim() === "" ? null : comment },
    { onConflict: "user_id,target_type,target_id" },
  );
  return { ok: !error };
}
