import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  readSessionFromToken,
  resolveAuthConfig,
  validateCredentials,
} from "./session";

describe("auth session", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disables auth by default in non-production when credentials are missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SHIMMY_UI_USERNAME", "");
    vi.stubEnv("SHIMMY_UI_PASSWORD", "");

    expect(resolveAuthConfig()).toMatchObject({
      enabled: false,
      required: false,
      credentialsConfigured: false,
    });
  });

  it("requires auth in production even when credentials are missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHIMMY_UI_USERNAME", "");
    vi.stubEnv("SHIMMY_UI_PASSWORD", "");

    expect(resolveAuthConfig()).toMatchObject({
      enabled: true,
      required: true,
      credentialsConfigured: false,
    });
  });

  it("creates and verifies a signed session token", () => {
    const auth = resolveAuthConfig({
      NODE_ENV: "production",
      SHIMMY_UI_USERNAME: "admin",
      SHIMMY_UI_PASSWORD: "secret",
      SHIMMY_UI_SESSION_SECRET: "token-secret",
      SHIMMY_UI_SESSION_TTL_SECONDS: "3600",
    });
    const token = createSessionToken("admin", auth, 1_000);

    expect(readSessionFromToken(token, auth, 2_000)).toEqual({
      user: "admin",
      exp: 3601,
    });
    expect(readSessionFromToken(`${token}x`, auth, 2_000)).toBeNull();
    expect(readSessionFromToken(token, auth, 4_000_000)).toBeNull();
  });

  it("validates credentials and clamps ttl", () => {
    const auth = resolveAuthConfig({
      NODE_ENV: "production",
      SHIMMY_UI_USERNAME: "admin",
      SHIMMY_UI_PASSWORD: "secret",
      SHIMMY_UI_SESSION_TTL_SECONDS: "1",
    });

    expect(auth.sessionTtlSeconds).toBe(60);
    expect(validateCredentials("admin", "secret", auth)).toBe(true);
    expect(validateCredentials("admin", "wrong", auth)).toBe(false);
  });
});
