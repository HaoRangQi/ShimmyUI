import { NextResponse } from "next/server";
import { RuntimeOperationBusyError, downloadRuntime } from "@/lib/shimmy/runtime-manager";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(await downloadRuntime());
  } catch (error) {
    if (error instanceof RuntimeOperationBusyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Download failed" },
      { status: 500 },
    );
  }
}
