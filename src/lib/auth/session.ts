import { createHmac, timingSafeEqual } from "node:crypto";

export const sessionCookieName = "shimmy_ui_session";
const defaultSessionTtlSeconds = 60 * 60 * 12;
const minSessionTtlSeconds = 60;
const maxSessionTtlSeconds = 60 * 60 * 24 * 30;
const fallbackSessionSecret = "shimmy-ui-dev-session";

type MaybeString = string | undefined;

export type AuthConfig = {
  enabled: boolean;
  required: boolean;
  credentialsConfigured: boolean;
  username?: string;
  password?: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
};

export type SessionPayload = {
  user: string;
  exp: number;
};

function normalized(value?: string): MaybeString {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseSessionTtlSeconds(raw?: string) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultSessionTtlSeconds;
  }
  return Math.min(Math.max(parsed, minSessionTtlSeconds), maxSessionTtlSeconds);
}

function deriveSessionSecret(
  explicitSecret: MaybeString,
  username: MaybeString,
  password: MaybeString,
) {
  if (explicitSecret) return explicitSecret;
  if (username && password) return `shimmy-ui-session:${username}:${password}`;
  return fallbackSessionSecret;
}

function signValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as Partial<SessionPayload>;
    if (!payload?.user || typeof payload.user !== "string") return null;
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
    return {
      user: payload.user,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function resolveAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const username = normalized(env.SHIMMY_UI_USERNAME);
  const password = normalized(env.SHIMMY_UI_PASSWORD);
  const required = env.NODE_ENV === "production";
  const credentialsConfigured = Boolean(username && password);
  const enabled = required || credentialsConfigured;
  const sessionSecret = deriveSessionSecret(
    normalized(env.SHIMMY_UI_SESSION_SECRET),
    username,
    password,
  );

  return {
    enabled,
    required,
    credentialsConfigured,
    username,
    password,
    sessionSecret,
    sessionTtlSeconds: parseSessionTtlSeconds(env.SHIMMY_UI_SESSION_TTL_SECONDS),
  };
}

export function validateCredentials(
  username: string,
  password: string,
  authConfig = resolveAuthConfig(),
) {
  if (!authConfig.credentialsConfigured) return false;
  if (!authConfig.username || !authConfig.password) return false;
  return safeEqual(username, authConfig.username) && safeEqual(password, authConfig.password);
}

export function createSessionToken(
  user: string,
  authConfig = resolveAuthConfig(),
  nowMs = Date.now(),
) {
  const payload: SessionPayload = {
    user,
    exp: Math.floor(nowMs / 1000) + authConfig.sessionTtlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signValue(encodedPayload, authConfig.sessionSecret);
  return `${encodedPayload}.${signature}`;
}

export function readSessionFromToken(
  token: string | undefined,
  authConfig = resolveAuthConfig(),
  nowMs = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const [encodedPayload, signature, ...extra] = token.split(".");
  if (!encodedPayload || !signature || extra.length > 0) return null;

  const expectedSignature = signValue(encodedPayload, authConfig.sessionSecret);
  if (!safeEqual(signature, expectedSignature)) return null;

  const payload = decodePayload(encodedPayload);
  if (!payload) return null;
  if (payload.exp <= Math.floor(nowMs / 1000)) return null;
  return payload;
}

export function sessionCookieOptions(authConfig = resolveAuthConfig()) {
  return {
    httpOnly: true,
    secure: authConfig.required,
    sameSite: "lax" as const,
    path: "/",
    maxAge: authConfig.sessionTtlSeconds,
  };
}

export function shouldUseSecureCookie(
  request: Pick<Request, "url" | "headers">,
  authConfig = resolveAuthConfig(),
) {
  if (!authConfig.required) return false;
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProto) {
    return forwardedProto === "https";
  }
  return request.url.toLowerCase().startsWith("https://");
}
