import { NextResponse } from "next/server";
import { z } from "zod";
import { listHuggingFaceGgufFiles } from "@/lib/model-library/huggingface";

export const runtime = "nodejs";

const querySchema = z.object({
  repoId: z.string().trim().min(1),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    repoId: params.get("repoId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Missing Hugging Face repo id" }, { status: 400 });
  }
  try {
    const files = await listHuggingFaceGgufFiles(parsed.data.repoId);
    return NextResponse.json({ ok: true, files });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        files: [],
        error: error instanceof Error ? error.message : "Failed to list GGUF files",
      },
      { status: 502 },
    );
  }
}
