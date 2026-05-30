import { describe, expect, it } from "vitest";
import { ShimmyProcessManager } from "./process-manager";

describe("ShimmyProcessManager status", () => {
  const binary = {
    path: "/bin/shimmy",
    exists: true,
    executable: true,
    source: "configured" as const,
  };

  it("reports missing-binary without an executable candidate", () => {
    const manager = new ShimmyProcessManager();
    expect(manager.status(null, false)).toBe("missing-binary");
  });

  it("reports external service without taking ownership", () => {
    const manager = new ShimmyProcessManager();
    expect(manager.status(binary, true)).toBe("running-external");
  });

  it("reports stopped when binary exists and no service is healthy", () => {
    const manager = new ShimmyProcessManager();
    expect(manager.status(binary, false)).toBe("stopped");
  });
});
