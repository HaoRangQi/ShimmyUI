import { NextResponse } from "next/server";
import { listManagedModels } from "@/lib/model-library/model-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, models: await listManagedModels() });
}
