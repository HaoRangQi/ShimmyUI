import { NextResponse } from "next/server";
import { z } from "zod";
import { pullOllamaModel } from "@/lib/model-library/ollama";

export const runtime = "nodejs";

const schema = z.object({
  model: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Missing Ollama model name" }, { status: 400 });
  }
  try {
    return NextResponse.json(await pullOllamaModel({ model: body.data.model }));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Ollama pull failed" },
      { status: 502 },
    );
  }
}
