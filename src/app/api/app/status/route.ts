import { NextResponse } from "next/server";
import { getAppStatus } from "@/lib/shimmy/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAppStatus());
}
