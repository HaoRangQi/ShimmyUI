import { NextResponse } from "next/server";
import { z } from "zod";
import { catalogModels } from "@/lib/model-library/catalog";
import { downloadCatalogModel } from "@/lib/model-library/model-store";
import { detectShimmyBinary } from "@/lib/shimmy/binary";
import { configStore } from "@/lib/shimmy/config-store";
import { shimmyProcessManager } from "@/lib/shimmy/process-manager";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Missing catalog model id" }, { status: 400 });
  }
  const model = catalogModels.find((item) => item.id === body.data.id);
  if (!model) {
    return NextResponse.json({ ok: false, error: "Catalog model not found" }, { status: 404 });
  }
  try {
    const config = await configStore.read();
    const detection = await detectShimmyBinary(config);
    return NextResponse.json(
      await downloadCatalogModel({
        model,
        readConfig: async () => config,
        writeConfig: (config) => configStore.write(config),
        probeModel: detection.selected
          ? (modelName) => shimmyProcessManager.probe(detection.selected!, modelName)
          : undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Download failed" },
      { status: 400 },
    );
  }
}
