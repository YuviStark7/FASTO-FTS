import "server-only";
import { requireUser } from "@/lib/auth";

export type StaffRole = "admin" | "analyst";

/** Highest staff role of the signed-in user, read through RLS (a user sees their own memberships). */
export async function getStaffRole() {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase.from("memberships").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((m) => m.role);
  const role: StaffRole | null = roles.includes("admin") ? "admin" : roles.includes("analyst") ? "analyst" : null;
  return { supabase, userId, role };
}
