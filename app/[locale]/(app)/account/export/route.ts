import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { collectAccountData } from "@/lib/account/export";

/** Downloads the signed-in user's own data as JSON (RLS limits it to what they may read). */
export async function GET() {
  const { supabase, userId, email } = await requireUser();
  const data = await collectAccountData(supabase, userId, email);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fasto-fts-account-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
