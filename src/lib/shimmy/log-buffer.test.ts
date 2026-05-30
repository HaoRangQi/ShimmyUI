import { describe, expect, it } from "vitest";
import { LogBuffer } from "./log-buffer";

describe("LogBuffer", () => {
  it("keeps entries in insertion order", () => {
    const logs = new LogBuffer(3);
    logs.push("system", "boot");
    logs.push("stdout", "ready");

    expect(logs.list().map((entry) => entry.message)).toEqual([
      "boot",
      "ready",
    ]);
  });

  it("evicts oldest entries when full", () => {
    const logs = new LogBuffer(2);
    logs.push("stdout", "one");
    logs.push("stdout", "two");
    logs.push("stderr", "three");

    expect(logs.list().map((entry) => entry.message)).toEqual(["two", "three"]);
  });
});
