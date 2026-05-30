import { NextResponse } from "next/server";
import { configStore } from "@/lib/shimmy/config-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = await configStore.write(await request.json());
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid settings",
      },
      { status: 400 },
    );
  }
}
