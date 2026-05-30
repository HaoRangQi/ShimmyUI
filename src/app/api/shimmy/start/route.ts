import { NextResponse } from "next/server";
import { detectShimmyBinary } from "@/lib/shimmy/binary";
import { configStore } from "@/lib/shimmy/config-store";
import { readHealth } from "@/lib/shimmy/http-client";
import { shimmyProcessManager } from "@/lib/shimmy/process-manager";

export const runtime = "nodejs";

export async function POST() {
  const config = await configStore.read();
  const detection = await detectShimmyBinary(config);
  if (!detection.selected) {
    return NextResponse.json(
      { ok: false, error: "Shimmy binary was not found or is not executable" },
      { status: 404 },
    );
  }

  try {
    const health = await readHealth(config.bindAddress);
    if (health.ok) {
      return NextResponse.json({ ok: true, state: "running-external", external: true });
    }
    const result = await shimmyProcessManager.start(detection.selected, config);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to start shimmy",
      },
      { status: 500 },
    );
  }
}
