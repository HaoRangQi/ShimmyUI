import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { ShimmyUiConfig } from "./types";

export const defaultConfig: ShimmyUiConfig = {
  bindAddress: "127.0.0.1:11435",
  modelDirs: [],
  gpuBackend: "auto",
  language: "zh",
  theme: "dark",
};

export const configSchema = z.object({
  shimmyPath: z.string().trim().min(1).optional(),
  bindAddress: z.string().regex(/^[\w.:-]+:\d{1,5}$/),
  modelDirs: z.array(z.string().trim().min(1)).default([]),
  baseGguf: z.string().trim().min(1).optional(),
  maxCtx: z.number().int().min(512).max(131_072).optional(),
  gpuBackend: z.enum(["auto", "cpu", "cuda", "vulkan", "opencl"]).default("auto"),
  language: z.enum(["en", "zh"]).catch("zh").default("zh"),
  theme: z.enum(["dark", "light", "system"]).default("dark"),
  defaultModel: z.string().trim().min(1).optional(),
});

export function getConfigPath(homeDir = os.homedir()) {
  return path.join(homeDir, ".shimmy-ui", "config.json");
}

export function normalizeConfig(input: unknown): ShimmyUiConfig {
  const parsed = configSchema.partial().parse(input ?? {});
  return {
    ...defaultConfig,
    ...parsed,
    modelDirs: parsed.modelDirs ?? defaultConfig.modelDirs,
  };
}
