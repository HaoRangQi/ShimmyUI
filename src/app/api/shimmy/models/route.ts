import { NextResponse } from "next/server";
import { configStore } from "@/lib/shimmy/config-store";
import { readModels } from "@/lib/shimmy/http-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await configStore.read();
  try {
    return NextResponse.json({ ok: true, models: await readModels(config.bindAddress) });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        models: [],
        error: error instanceof Error ? error.message : "Failed to read models",
      },
      { status: 502 },
    );
  }
}
