import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

export type Role = "admin" | "analyst" | "member" | "viewer";

/** Creates a fresh user with the given role and signs the page in through the real magic-link route. */
export async function signIn(page: Page, role: Role = "member", tag = "e2e") {
  const email = `${tag}-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties) throw error ?? new Error("no link");
  if (role !== "member") {
    const { error: e } = await admin.from("memberships").update({ role }).eq("user_id", data.user.id);
    if (e) throw e;
  }
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/`);
  await page.waitForURL((u) => !u.pathname.includes("/login"));
  return { email, userId: data.user.id };
}
