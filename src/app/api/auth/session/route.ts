import { NextResponse } from "next/server";
import {
  readSessionFromToken,
  resolveAuthConfig,
  sessionCookieName,
} from "@/lib/auth/session";

export const runtime = "nodejs";

function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  const needle = `${name}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(needle));
  if (!cookie) return undefined;
  return decodeURIComponent(cookie.slice(needle.length));
}

export async function GET(request: Request) {
  const auth = resolveAuthConfig();
  if (!auth.enabled) {
    return NextResponse.json({
      ok: true,
      authenticated: true,
      auth: { enabled: false, required: false, configured: auth.credentialsConfigured },
    });
  }

  if (!auth.credentialsConfigured || !auth.username) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        auth: { enabled: true, required: auth.required, configured: false },
        error: "Authentication is enabled but SHIMMY_UI_USERNAME/SHIMMY_UI_PASSWORD is missing",
      },
      { status: 503 },
    );
  }

  const token = readCookieValue(request.headers.get("cookie"), sessionCookieName);
  const session = readSessionFromToken(token, auth);
  const authenticated = Boolean(session && session.user === auth.username);

  return NextResponse.json({
    ok: true,
    authenticated,
    auth: { enabled: true, required: auth.required, configured: true },
    user: authenticated ? auth.username : undefined,
  });
}
