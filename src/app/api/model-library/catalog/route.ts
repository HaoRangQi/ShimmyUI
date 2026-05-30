import { NextResponse } from "next/server";
import { compatibleCatalogModels } from "@/lib/model-library/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ ok: true, models: compatibleCatalogModels(undefined, query) });
}
