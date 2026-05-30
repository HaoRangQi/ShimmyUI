import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectShimmyBinary } from "./binary";
import { configStore } from "./config-store";
import { readHealth, readMetrics } from "./http-client";
import { inspectModelDirectories } from "./model-dirs";
import { shimmyProcessManager } from "./process-manager";
import type { AppStatus } from "./types";

const execFileAsync = promisify(execFile);

export async function getAppStatus(): Promise<AppStatus> {
  const config = await configStore.read();
  const detection = await detectShimmyBinary(config);
  const health = await readHealth(config.bindAddress);
  const metrics = await readMetrics(config.bindAddress);
  const modelDirsHealth = await inspectModelDirectories(config.modelDirs);
  const state = shimmyProcessManager.status(detection.selected, health.ok);

  return {
    state,
    config,
    binary: detection.selected,
    managedPid: shimmyProcessManager.pid,
    health,
    metrics,
    modelDirsHealth,
    logsCount: shimmyProcessManager.logs.list().length,
  };
}

export async function runShimmyInfoCommand(
  shimmyPath: string,
  args: string[],
  timeout = 5_000,
) {
  const { stdout, stderr } = await execFileAsync(shimmyPath, args, {
    timeout,
    env: { ...process.env },
    shell: false,
  });
  return {
    output: `${stdout}${stderr}`.trim(),
  };
}
