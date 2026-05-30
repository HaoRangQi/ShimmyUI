import { NextResponse } from "next/server";
import { shimmyProcessManager } from "@/lib/shimmy/process-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ logs: shimmyProcessManager.logs.list() });
}

export async function DELETE() {
  shimmyProcessManager.logs.clear();
  return NextResponse.json({ ok: true });
}
