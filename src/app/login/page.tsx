"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel, inputClass } from "@/components/ui";

function normalizeNextPath(raw: string | null) {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    const controller = new AbortController();
    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const resolvedNextPath = normalizeNextPath(params.get("next"));
      const configError = params.get("error") === "config";
      setNextPath(resolvedNextPath);
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(
            data.error ??
              "Authentication is required but not configured. Set SHIMMY_UI_USERNAME and SHIMMY_UI_PASSWORD.",
          );
          return;
        }
        if (!data.auth?.enabled || data.authenticated) {
          router.replace(resolvedNextPath);
          return;
        }
        if (configError) {
          setError(
            "Authentication is required but not configured. Set SHIMMY_UI_USERNAME and SHIMMY_UI_PASSWORD.",
          );
        }
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Unable to check session");
      } finally {
        setBooting(false);
      }
    }
    bootstrap();
    return () => controller.abort();
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("请输入用户名和密码。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setError(data.error ?? "登录失败");
        return;
      }
      router.replace(nextPath);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10">
      <Panel className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">Shimmy UI</h1>
        <p className="mt-2 text-sm text-[rgb(var(--muted))]">请先登录后再访问控制台。</p>
        {booting ? (
          <p className="mt-6 text-sm text-[rgb(var(--muted))]">正在检查会话状态...</p>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">用户名</span>
              <input
                className={inputClass}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-[rgb(var(--muted))]">密码</span>
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error ? (
              <p className="rounded-2xl bg-[rgb(var(--error-container))]/65 px-3 py-2 text-sm text-[rgb(var(--error))]">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        )}
      </Panel>
    </main>
  );
}
