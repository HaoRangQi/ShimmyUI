import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultConfig, getConfigPath, normalizeConfig } from "./config";
import type { ShimmyUiConfig } from "./types";

export class ConfigStore {
  constructor(private readonly filePath = getConfigPath()) {}

  path() {
    return this.filePath;
  }

  async read(): Promise<ShimmyUiConfig> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      if (!raw.trim()) return defaultConfig;
      return normalizeConfig(JSON.parse(raw));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return defaultConfig;
      }
      if (error instanceof SyntaxError) {
        return defaultConfig;
      }
      throw error;
    }
  }

  async write(input: unknown): Promise<ShimmyUiConfig> {
    const config = normalizeConfig(input);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
    return config;
  }
}

export const configStore = process.env.SHIMMY_UI_CONFIG_PATH
  ? new ConfigStore(process.env.SHIMMY_UI_CONFIG_PATH)
  : new ConfigStore();
