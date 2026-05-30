import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, resolveAuthConfig, sessionCookieName } from "@/lib/auth/session";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as session } from "./session/route";

describe("auth routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("logs in with env credentials and sets session cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHIMMY_UI_USERNAME", "admin");
    vi.stubEnv("SHIMMY_UI_PASSWORD", "secret");
    vi.stubEnv("SHIMMY_UI_SESSION_SECRET", "session-secret");

    const response = await login(
      new Request("http://shimmy.test/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "secret" }),
      }),
    );
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie");

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, authenticated: true });
    expect(setCookie).toContain(`${sessionCookieName}=`);
  });

  it("rejects invalid credentials", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHIMMY_UI_USERNAME", "admin");
    vi.stubEnv("SHIMMY_UI_PASSWORD", "secret");

    const response = await login(
      new Request("http://shimmy.test/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "bad" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ ok: false });
  });

  it("reports authenticated session from cookie token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHIMMY_UI_USERNAME", "admin");
    vi.stubEnv("SHIMMY_UI_PASSWORD", "secret");
    vi.stubEnv("SHIMMY_UI_SESSION_SECRET", "session-secret");
    const auth = resolveAuthConfig();
    const token = createSessionToken("admin", auth);

    const response = await session(
      new Request("http://shimmy.test/api/auth/session", {
        headers: { cookie: `${sessionCookieName}=${encodeURIComponent(token)}` },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, authenticated: true });
  });

  it("returns 503 when production credentials are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHIMMY_UI_USERNAME", "");
    vi.stubEnv("SHIMMY_UI_PASSWORD", "");

    const response = await session(
      new Request("http://shimmy.test/api/auth/session"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, authenticated: false });
  });

  it("clears session cookie on logout", async () => {
    const response = await logout(new Request("http://shimmy.test/api/auth/logout", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${sessionCookieName}=`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
