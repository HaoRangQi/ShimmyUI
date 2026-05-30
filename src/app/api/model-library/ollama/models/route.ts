import { NextResponse } from "next/server";
import { listOllamaModels } from "@/lib/model-library/ollama";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, models: await listOllamaModels() });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        models: [],
        error: error instanceof Error ? error.message : "Unable to list Ollama models",
      },
      { status: 502 },
    );
  }
}
