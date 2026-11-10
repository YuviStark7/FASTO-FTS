import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Magic-link landing. Handles both the PKCE code flow and the token_hash email template. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Redirect on the host the browser used, so the session cookie set here is sent back.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const origin = `${proto}://${host}`;
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    // Magic links for new users carry type "signup"; "email" verifies any email OTP.
    const otpType: EmailOtpType = type === "magiclink" || type === "signup" ? "email" : type;
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })).error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/login?error=link", origin));
}

/** Only same-site relative paths, so the link cannot be turned into an open redirect. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
