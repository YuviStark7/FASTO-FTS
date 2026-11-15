import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type DeleteResult = { ok: true } | { ok: false; reason: "confirm_mismatch" | "last_admin" | "failed" };

/**
 * Deletes an account and the data only it owns (SPEC section 4, compliance: delete).
 * - Refuses when the user is the last admin (the platform must keep one; the database refuses too).
 * - Deletes the user's personal organisations where they are the only member, with everything
 *   scoped to them (passports, weight sets, conversations, exports, feedback, watchlists).
 * - Deletes the auth user: profile, memberships, own conversations, feedback, watchlists and
 *   alerts cascade; usage rows and the created_by of shared items are set to null.
 * Audit log rows are append-only and keep the account id (no email).
 */
export async function deleteAccount(admin: SupabaseClient<Database>, userId: string, email: string, typed: string): Promise<DeleteResult> {
  if (typed.trim().toLowerCase() !== email.trim().toLowerCase() || !email) return { ok: false, reason: "confirm_mismatch" };

  const { data: mine, error: me } = await admin.from("memberships").select("org_id, role").eq("user_id", userId);
  if (me) return { ok: false, reason: "failed" };
  if ((mine ?? []).some((m) => m.role === "admin")) {
    const { count } = await admin.from("memberships").select("user_id", { count: "exact", head: true }).eq("role", "admin").neq("user_id", userId);
    if (!count) return { ok: false, reason: "last_admin" };
  }

  const orgIds = (mine ?? []).map((m) => m.org_id);
  if (orgIds.length) {
    const [{ data: orgs }, { data: members }] = await Promise.all([
      admin.from("organizations").select("id, is_personal").in("id", orgIds),
      admin.from("memberships").select("org_id, user_id").in("org_id", orgIds),
    ]);
    const solo = (orgs ?? [])
      .filter((o) => o.is_personal && (members ?? []).every((m) => m.org_id !== o.id || m.user_id === userId))
      .map((o) => o.id);
    if (solo.length) {
      const { error } = await admin.from("organizations").delete().in("id", solo);
      if (error) return { ok: false, reason: "failed" };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  return error ? { ok: false, reason: "failed" } : { ok: true };
}
