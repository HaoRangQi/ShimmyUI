import { NextResponse } from "next/server";
import { RuntimeOperationBusyError, uninstallRuntime } from "@/lib/shimmy/runtime-manager";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(await uninstallRuntime());
  } catch (error) {
    if (error instanceof RuntimeOperationBusyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Uninstall failed" },
      { status: 400 },
    );
  }
}
