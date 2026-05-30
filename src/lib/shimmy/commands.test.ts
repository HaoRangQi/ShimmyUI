import { describe, expect, it } from "vitest";
import { buildProbeCommand, buildServeCommand } from "./commands";
import { defaultConfig } from "./config";

describe("shimmy command construction", () => {
  it("builds serve with whitelisted arguments and no shell string", () => {
    const command = buildServeCommand("/bin/shimmy", {
      ...defaultConfig,
      bindAddress: "127.0.0.1:11436",
      gpuBackend: "vulkan",
      modelDirs: ["/models/a", "/models/b"],
      baseGguf: "/models/base.gguf",
      maxCtx: 4096,
    });

    expect(command.command).toBe("/bin/shimmy");
    expect(command.args).toEqual([
      "serve",
      "--bind",
      "127.0.0.1:11436",
      "--gpu-backend",
      "vulkan",
    ]);
    expect(command.env).toEqual({
      SHIMMY_MODEL_PATHS: "/models/a;/models/b",
      SHIMMY_BASE_GGUF: "/models/base.gguf",
      SHIMMY_MAX_CTX: "4096",
    });
  });

  it("builds probe as positional CLI invocation", () => {
    expect(buildProbeCommand("/bin/shimmy", "tinyllama")).toEqual({
      command: "/bin/shimmy",
      args: ["probe", "tinyllama"],
      env: {},
    });
  });
});
