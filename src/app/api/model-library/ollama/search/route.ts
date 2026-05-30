import { NextResponse } from "next/server";
import { searchOllamaCatalog } from "@/lib/model-library/ollama";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ ok: true, models: searchOllamaCatalog(query) });
}
