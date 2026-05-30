import { NextResponse } from "next/server";
import {
  resolveAuthConfig,
  sessionCookieName,
  shouldUseSecureCookie,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = resolveAuthConfig();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request, auth),
    path: "/",
    maxAge: 0,
  });
  return response;
}
