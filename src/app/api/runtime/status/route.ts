import { NextResponse } from "next/server";
import { runtimeStatus } from "@/lib/shimmy/runtime-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await runtimeStatus());
}
