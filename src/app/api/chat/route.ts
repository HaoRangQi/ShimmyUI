import { NextResponse } from "next/server";
import { configStore } from "@/lib/shimmy/config-store";
import { shimmyBaseUrl } from "@/lib/shimmy/http-client";

export const runtime = "nodejs";

const maxChatBodyBytes = 256 * 1024;
const chatProxyTimeoutMs = Number(process.env.SHIMMY_UI_CHAT_TIMEOUT_MS ?? 30_000);

export async function POST(request: Request) {
  const config = await configStore.read();
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxChatBodyBytes) {
    return NextResponse.json(
      { ok: false, error: "Chat request body is too large" },
      { status: 413 },
    );
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort("timeout"), chatProxyTimeoutMs);
  const abortFromClient = () => timeoutController.abort("client-abort");
  request.signal.addEventListener("abort", abortFromClient, { once: true });

  let response: Response;
  try {
    response = await fetch(`${shimmyBaseUrl(config.bindAddress)}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (timeoutController.signal.aborted && timeoutController.signal.reason === "timeout") {
      return NextResponse.json(
        { ok: false, error: "Shimmy chat request timed out" },
        { status: 504 },
      );
    }
    if (timeoutController.signal.aborted) {
      return NextResponse.json(
        { ok: false, error: "Shimmy chat request was cancelled" },
        { status: 499 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Shimmy chat request failed",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromClient);
  }

  if (!response.ok || !response.body) {
    return NextResponse.json(
      {
        error: `Shimmy chat request failed: ${response.status} ${response.statusText}`,
      },
      { status: response.status || 502 },
    );
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "text/event-stream",
      "cache-control": "no-store",
    },
  });
}
