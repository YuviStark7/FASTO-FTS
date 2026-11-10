import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Defence in depth behind the middleware: every signed-in screen calls this. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return { supabase, userId: data.claims.sub, email: (data.claims.email as string | undefined) ?? "" };
}
