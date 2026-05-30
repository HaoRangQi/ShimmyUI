import type { ShimmyUiConfig } from "./types";

export interface ShimmyCommand {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export function buildServeCommand(
  shimmyPath: string,
  config: ShimmyUiConfig,
): ShimmyCommand {
  const args = ["serve", "--bind", config.bindAddress];
  if (config.gpuBackend !== "auto") {
    args.push("--gpu-backend", config.gpuBackend);
  }

  const env: Record<string, string> = {};
  if (config.modelDirs.length > 0) {
    env.SHIMMY_MODEL_PATHS = config.modelDirs.join(";");
  }
  if (config.baseGguf) {
    env.SHIMMY_BASE_GGUF = config.baseGguf;
  }
  if (config.maxCtx) {
    env.SHIMMY_MAX_CTX = String(config.maxCtx);
  }

  return {
    command: shimmyPath,
    args,
    env,
  };
}

export function buildProbeCommand(shimmyPath: string, modelName: string) {
  return {
    command: shimmyPath,
    args: ["probe", modelName],
    env: {},
  };
}
