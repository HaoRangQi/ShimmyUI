import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteManagedModel, renameManagedModel } from "@/lib/model-library/model-store";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().trim().min(1),
});

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  try {
    return NextResponse.json(await deleteManagedModel({ name: decodeURIComponent(name) }));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 404 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Missing model name" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await renameManagedModel({
        name: decodeURIComponent(name),
        nextName: body.data.name,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Rename failed" },
      { status: 400 },
    );
  }
}
