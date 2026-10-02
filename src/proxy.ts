import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  let responseHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          responseHeaders = { ...responseHeaders, ...headers };
          Object.entries(headers).forEach(([name, value]) =>
            supabaseResponse.headers.set(name, value),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isNewScore = pathname === "/scores/new";
  const isNewCabinet = pathname === "/cabinets/new";
  const isEditScore = /^\/scores\/\d+\/edit$/.test(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const redirectPath = !user && (isDashboard || isNewScore || isEditScore || isNewCabinet)
    ? "/login"
    : user && isAuthPage
      ? "/dashboard"
      : null;

  if (!redirectPath) return supabaseResponse;

  const redirectResponse = NextResponse.redirect(
    new URL(redirectPath, request.url),
  );
  supabaseResponse.cookies.getAll().forEach((cookie) =>
    redirectResponse.cookies.set(cookie),
  );
  Object.entries(responseHeaders).forEach(([name, value]) =>
    redirectResponse.headers.set(name, value),
  );
  return redirectResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
