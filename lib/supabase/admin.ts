import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/** Service-role client. Bypasses RLS: server code only, never imported by a client component. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(env.supabaseUrl, key, { auth: { persistSession: false } });
}
