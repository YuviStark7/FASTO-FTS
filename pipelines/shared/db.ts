import { createClient } from "@supabase/supabase-js";

/** Service-role client for pipelines. Runs in GitHub Actions or locally; never in the browser. */
export function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}
