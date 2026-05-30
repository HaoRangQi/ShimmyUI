import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  resolveAuthConfig,
  shouldUseSecureCookie,
  sessionCookieName,
  sessionCookieOptions,
  validateCredentials,
} from "@/lib/auth/session";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = resolveAuthConfig();
  if (!auth.enabled) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      auth: { enabled: false, configured: auth.credentialsConfigured },
    });
  }

  if (!auth.credentialsConfigured || !auth.username) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authentication is enabled but SHIMMY_UI_USERNAME/SHIMMY_UI_PASSWORD is missing",
      },
      { status: 503 },
    );
  }

  const body = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { ok: false, error: "Missing username or password" },
      { status: 400 },
    );
  }

  if (!validateCredentials(body.data.username, body.data.password, auth)) {
    return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
  }

  const token = createSessionToken(auth.username, auth);
  const response = NextResponse.json({
    ok: true,
    authenticated: true,
    auth: { enabled: true, configured: true },
  });
  response.cookies.set(sessionCookieName, token, {
    ...sessionCookieOptions(auth),
    secure: shouldUseSecureCookie(request, auth),
  });
  return response;
}
