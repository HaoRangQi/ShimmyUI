import { NextResponse } from "next/server";
import { z } from "zod";
import { searchHuggingFaceModels } from "@/lib/model-library/huggingface";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  sort: z.enum(["trending", "downloads", "updated"]).optional().default("downloads"),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    q: params.get("q") ?? "",
    limit: params.get("limit") ?? 20,
    sort: params.get("sort") ?? "downloads",
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid search params" }, { status: 400 });
  }
  try {
    const models = await searchHuggingFaceModels({
      query: parsed.data.q,
      limit: parsed.data.limit,
      sort: parsed.data.sort,
    });
    return NextResponse.json({ ok: true, models });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        models: [],
        error:
          error instanceof Error
            ? error.message
            : "Failed to search Hugging Face models",
      },
      { status: 502 },
    );
  }
}
