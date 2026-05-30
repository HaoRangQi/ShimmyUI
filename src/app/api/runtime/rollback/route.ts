import { NextResponse } from "next/server";
import { RuntimeOperationBusyError, rollbackRuntime } from "@/lib/shimmy/runtime-manager";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await rollbackRuntime(body.backupPath));
  } catch (error) {
    if (error instanceof RuntimeOperationBusyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Rollback failed" },
      { status: 400 },
    );
  }
}
