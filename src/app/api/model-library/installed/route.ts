import { NextResponse } from "next/server";
import {
  listManagedModels,
  syncManagedModelDirsFromMetadata,
} from "@/lib/model-library/model-store";
import { detectShimmyBinary } from "@/lib/shimmy/binary";
import { configStore } from "@/lib/shimmy/config-store";
import { shimmyProcessManager } from "@/lib/shimmy/process-manager";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sync = await syncManagedModelDirsFromMetadata({
      readConfig: () => configStore.read(),
      writeConfig: (config) => configStore.write(config),
    });
    if (sync.updated && shimmyProcessManager.pid) {
      const config = await configStore.read();
      const detection = await detectShimmyBinary(config);
      if (detection.selected) {
        await shimmyProcessManager.stop();
        await shimmyProcessManager.start(detection.selected, config);
      }
    }
  } catch {
    // Non-fatal: keep listing models even if config sync fails.
  }
  return NextResponse.json({ ok: true, models: await listManagedModels() });
}
