import { NextResponse } from "next/server";
import { shimmyProcessManager } from "@/lib/shimmy/process-manager";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ ok: true, ...(await shimmyProcessManager.stop()) });
}
