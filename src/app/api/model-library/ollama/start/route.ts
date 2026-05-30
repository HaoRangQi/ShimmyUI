import { NextResponse } from "next/server";
import { startOllama } from "@/lib/model-library/ollama";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(await startOllama());
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to start Ollama" },
      { status: 500 },
    );
  }
}
