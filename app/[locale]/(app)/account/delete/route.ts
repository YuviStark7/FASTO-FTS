import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount } from "@/lib/account/delete";

/**
 * Deletes the signed-in user's own account after they typed their email. A plain POST route
 * (not a server action) so the result never depends on the client router; signs out on success.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const typed = typeof body?.email === "string" && body.email.length <= 320 ? body.email : "";
  const { supabase, userId, email } = await requireUser();
  const r = await deleteAccount(createAdminClient(), userId, email, typed);
  if (r.ok) await supabase.auth.signOut();
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === "failed" ? 500 : 400, headers: { "Cache-Control": "no-store" } });
}
