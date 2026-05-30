import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectShimmyBinary } from "./binary";
import { defaultConfig } from "./config";

describe("shimmy binary detection", () => {
  it("selects an executable configured binary first", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-test-"));
    const bin = path.join(dir, `shimmy-${Date.now()}`);
    await writeFile(
      bin,
      "#!/usr/bin/env node\nconsole.log('shimmy 2.0.1 test')\n",
      "utf8",
    );
    await chmod(bin, 0o755);

    const result = await detectShimmyBinary(
      { ...defaultConfig, shimmyPath: bin },
      dir,
      dir,
    );

    expect(result.selected?.path).toBe(bin);
    expect(result.selected?.source).toBe("configured");
    expect(result.selected?.version).toContain("shimmy 2.0.1 test");
  });
});
