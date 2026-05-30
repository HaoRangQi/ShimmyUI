import { NextResponse } from "next/server";
import { z } from "zod";
import { detectShimmyBinary } from "@/lib/shimmy/binary";
import { configStore } from "@/lib/shimmy/config-store";
import { shimmyProcessManager } from "@/lib/shimmy/process-manager";

export const runtime = "nodejs";

const schema = z.object({
  model: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Missing model name" }, { status: 400 });
  }
  const config = await configStore.read();
  const detection = await detectShimmyBinary(config);
  if (!detection.selected) {
    return NextResponse.json({ ok: false, error: "Shimmy binary not found" }, { status: 404 });
  }
  const result = await shimmyProcessManager.probe(detection.selected, body.data.model);
  return NextResponse.json(result);
}
