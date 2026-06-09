import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { evaluateAppAccess } from "@/modules/access-control/access-control.service";
import { consumeRateLimit, createRateLimitKey, getRequestIp } from "@/modules/rate-limit/rate-limit.service";

const appEntryRateLimit = {
  action: "auth_app_entry",
  limit: 240,
  windowSeconds: 300
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  const isCronRoute = pathname.startsWith("/api/cron/");
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth/callback");
  const isAccessStatusRoute = pathname.startsWith("/verify-email") || pathname.startsWith("/access-denied");

  if (isCronRoute) {
    return response;
  }

  const rateLimit =
    process.env.RATE_LIMIT_ENABLED === "false"
      ? { allowed: true, retryAfterSeconds: appEntryRateLimit.windowSeconds }
      : await consumeRateLimit(supabase, {
          ...appEntryRateLimit,
          key: createRateLimitKey([getRequestIp(request), pathname])
        });

  if (!rateLimit.allowed) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
        }
      );
    }

    return new NextResponse("Too many requests.", {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
    });
  }

  if (!user && !isAuthRoute) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (!user) {
    return response;
  }

  const access = await evaluateAppAccess(supabase, user);

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectUrl = new URL(access.allowed ? "/" : access.redirectTo, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (!access.allowed && !isAuthRoute && !isAccessStatusRoute) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: access.reason === "email_unverified" ? "Email verification required." : "Access denied." },
        { status: access.reason === "email_unverified" ? 403 : 403 }
      );
    }

    const redirectUrl = new URL(access.redirectTo, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (access.allowed && isAccessStatusRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
