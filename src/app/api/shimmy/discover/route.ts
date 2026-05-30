import { NextResponse } from "next/server";
import { configStore } from "@/lib/shimmy/config-store";
import { discoverModels } from "@/lib/shimmy/http-client";

export const runtime = "nodejs";

export async function POST() {
  const config = await configStore.read();
  try {
    return NextResponse.json({
      ok: true,
      models: await discoverModels(config.bindAddress),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        models: [],
        error: error instanceof Error ? error.message : "Discovery failed",
      },
      { status: 502 },
    );
  }
}
