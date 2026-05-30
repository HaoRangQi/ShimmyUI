import { NextRequest, NextResponse } from "next/server";
import {
  readSessionFromToken,
  resolveAuthConfig,
  sessionCookieName,
} from "@/lib/auth/session";

function isPublicPath(pathname: string) {
  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/session" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return true;
  }
  return /\.[a-z0-9]+$/i.test(pathname);
}

function unauthorizedApi(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const auth = resolveAuthConfig();
  if (!auth.enabled) {
    return NextResponse.next();
  }

  if (!auth.credentialsConfigured || !auth.username) {
    const error = "Authentication is enabled but SHIMMY_UI_USERNAME/SHIMMY_UI_PASSWORD is missing";
    if (pathname.startsWith("/api/")) {
      return unauthorizedApi(503, error);
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "?error=config";
    return NextResponse.redirect(loginUrl);
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  const session = readSessionFromToken(token, auth);
  const authenticated = Boolean(session && session.user === auth.username);
  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return unauthorizedApi(401, "Unauthorized");
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/:path*"],
};
