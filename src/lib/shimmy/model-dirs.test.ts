import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectModelDirectories } from "./model-dirs";

describe("model directory health", () => {
  it("reports when no model directories are configured", async () => {
    await expect(inspectModelDirectories([])).resolves.toEqual({
      configured: false,
      directories: [],
      totalGgufFiles: 0,
      hasReadableDirectory: false,
      hasModels: false,
    });
  });

  it("counts gguf files in readable directories", async () => {
    const root = await mkdir(path.join(os.tmpdir(), `shimmy-ui-models-${Date.now()}`), {
      recursive: true,
    });
    if (!root) throw new Error("Failed to create model test directory");
    const nested = path.join(root, "nested");
    await mkdir(nested);
    await writeFile(path.join(root, "tiny.gguf"), "model");
    await writeFile(path.join(nested, "small.GGUF"), "model");
    await writeFile(path.join(root, "notes.txt"), "ignore");

    await expect(inspectModelDirectories([root])).resolves.toMatchObject({
      configured: true,
      totalGgufFiles: 2,
      hasReadableDirectory: true,
      hasModels: true,
      directories: [
        expect.objectContaining({
          path: root,
          exists: true,
          readable: true,
          ggufFiles: 2,
        }),
      ],
    });
  });

  it("reports missing directories without throwing", async () => {
    const missing = path.join(os.tmpdir(), `shimmy-ui-missing-${Date.now()}`);

    await expect(inspectModelDirectories([missing])).resolves.toMatchObject({
      configured: true,
      totalGgufFiles: 0,
      hasReadableDirectory: false,
      hasModels: false,
      directories: [
        expect.objectContaining({
          path: missing,
          exists: false,
          readable: false,
          ggufFiles: 0,
        }),
      ],
    });
  });
});
