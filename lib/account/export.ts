import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Everything the platform holds about one user (SPEC section 4, compliance: export).
 * Read with the user's own client, so RLS decides what is included: their profile and
 * memberships, their conversations, feedback, watchlists and alerts, their usage records, and
 * the organisation items they created (passports, weight sets, exports). Market data is not
 * personal data and is not included.
 */
export async function collectAccountData(supabase: SupabaseClient<Database>, userId: string, email: string) {
  const [profile, memberships, conversations, feedback, watchlists, alerts, usage, passports, weightSets, exports] = await Promise.all([
    supabase.from("profiles").select("display_name, locale, created_at").eq("id", userId).maybeSingle(),
    supabase.from("memberships").select("role, created_at, organizations(id, name, is_personal, created_at)").eq("user_id", userId),
    supabase.from("conversations").select("id, title, locale, created_at, messages(role, content, created_at)").eq("user_id", userId).order("created_at"),
    supabase.from("feedback").select("target_type, target_id, rating, comment, created_at").eq("user_id", userId),
    supabase.from("watchlists").select("category_id, territory_id, created_at").eq("user_id", userId),
    supabase.from("alerts").select("*").eq("user_id", userId),
    supabase.from("usage").select("module, kind, model, input_tokens, output_tokens, cost_usd, created_at").eq("user_id", userId).order("created_at"),
    supabase.from("product_passports").select("name, category_id, price_band, certifications, format, story, capacity, attributes, created_at, updated_at").eq("created_by", userId),
    supabase.from("weight_sets").select("name, weights, created_at, updated_at").eq("created_by", userId),
    supabase.from("exports").select("brief_version_id, format, created_at").eq("user_id", userId),
  ]);
  return {
    exported_at: new Date().toISOString(),
    account: { user_id: userId, email, profile: profile.data },
    memberships: memberships.data ?? [],
    conversations: conversations.data ?? [],
    feedback: feedback.data ?? [],
    watchlists: watchlists.data ?? [],
    alerts: alerts.data ?? [],
    ai_usage: usage.data ?? [],
    product_passports: passports.data ?? [],
    weight_sets: weightSets.data ?? [],
    exports: exports.data ?? [],
    note: "Audit log entries that name this account are kept (append-only record of changes to roles, weights, sources and briefs); they hold the account id, not the email.",
  };
}
