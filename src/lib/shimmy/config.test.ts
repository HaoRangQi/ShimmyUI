import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getConfigPath, normalizeConfig } from "./config";
import { ConfigStore } from "./config-store";

describe("shimmy UI config", () => {
  it("applies safe local defaults", () => {
    expect(normalizeConfig({})).toEqual({
      bindAddress: "127.0.0.1:11435",
      modelDirs: [],
      gpuBackend: "auto",
      language: "zh",
      theme: "dark",
    });
  });

  it("accepts max context inside shimmy supported range", () => {
    expect(normalizeConfig({ maxCtx: 512 }).maxCtx).toBe(512);
    expect(normalizeConfig({ maxCtx: 131_072 }).maxCtx).toBe(131_072);
  });

  it("defaults invalid language settings to Chinese", () => {
    expect(normalizeConfig({ language: "invalid" }).language).toBe("zh");
  });

  it("rejects max context outside shimmy supported range", () => {
    expect(() => normalizeConfig({ maxCtx: 511 })).toThrow();
    expect(() => normalizeConfig({ maxCtx: 131_073 })).toThrow();
  });

  it("stores config under the user shimmy-ui directory", () => {
    expect(getConfigPath("/Users/tester")).toBe(
      "/Users/tester/.shimmy-ui/config.json",
    );
  });

  it("falls back to defaults when the config file is empty or invalid during concurrent reads", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-config-"));
    const file = path.join(dir, "config.json");
    const store = new ConfigStore(file);

    await writeFile(file, "", "utf8");
    await expect(store.read()).resolves.toEqual(normalizeConfig({}));

    await writeFile(file, "{", "utf8");
    await expect(store.read()).resolves.toEqual(normalizeConfig({}));
  });

  it("writes config through a normalized JSON file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-config-"));
    const file = path.join(dir, "config.json");
    const store = new ConfigStore(file);

    await store.write({ bindAddress: "127.0.0.1:11436", modelDirs: ["/models"] });

    await expect(readFile(file, "utf8")).resolves.toContain('"bindAddress": "127.0.0.1:11436"');
    await expect(store.read()).resolves.toMatchObject({
      bindAddress: "127.0.0.1:11436",
      modelDirs: ["/models"],
    });
  });
});
