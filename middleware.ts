import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/lib/i18n/routing";

const intl = createIntlMiddleware(routing);

// Routes reachable without signing in (locale prefix stripped).
const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const response = intl(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refreshes the session cookie. Do not remove: Server Components cannot write cookies.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const bare = isEn ? pathname.slice(3) || "/" : pathname;
  const isPublic = PUBLIC_PATHS.some((p) => bare === p || bare.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `${isEn ? "/en" : ""}/login`;
    url.searchParams.set("next", bare);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  // Skip API, auth callback, Next internals and static files.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
