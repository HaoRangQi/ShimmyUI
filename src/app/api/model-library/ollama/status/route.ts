import { NextResponse } from "next/server";
import { readOllamaStatus } from "@/lib/model-library/ollama";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, status: await readOllamaStatus() });
}
