import { NextResponse } from "next/server";
import { detectShimmyBinary } from "@/lib/shimmy/binary";
import { configStore } from "@/lib/shimmy/config-store";
import { runShimmyInfoCommand } from "@/lib/shimmy/runtime";

export const runtime = "nodejs";

export async function GET() {
  const config = await configStore.read();
  const detection = await detectShimmyBinary(config);
  if (!detection.selected) {
    return NextResponse.json({ ok: false, error: "Shimmy binary not found" }, { status: 404 });
  }
  try {
    const result = await runShimmyInfoCommand(detection.selected.path, ["gpu-info"]);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "gpu-info failed",
      },
      { status: 500 },
    );
  }
}
