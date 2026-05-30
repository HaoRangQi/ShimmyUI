import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  RuntimeOperationBusyError,
  latestShimmyRelease,
  readVerifiedRuntimeFile,
  selectReleaseAsset,
  verifySha256,
  withRuntimeOperationLock,
} from "./runtime-manager";

describe("shimmy runtime manager", () => {
  it("selects platform-specific release assets", () => {
    const release = {
      tag_name: "v2.0.1",
      assets: [
        { name: "shimmy", browser_download_url: "generic" },
        { name: "shimmy-macos-arm64", browser_download_url: "arm" },
        { name: "shimmy-windows-x86_64.exe", browser_download_url: "win" },
      ],
    };

    expect(selectReleaseAsset(release, "darwin", "arm64")?.downloadUrl).toBe("arm");
    expect(selectReleaseAsset(release, "win32", "x64")?.downloadUrl).toBe("win");
  });

  it("verifies GitHub release sha256 digests", () => {
    const data = Buffer.from("shimmy-binary");
    const digest = `sha256:${createHash("sha256").update(data).digest("hex")}`;

    expect(verifySha256(data, digest)).toBe(digest.slice("sha256:".length));
    expect(() => verifySha256(Buffer.from("tampered"), digest)).toThrow(
      /Checksum mismatch/,
    );
  });

  it("rechecks downloaded files before installation uses them", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-runtime-test-"));
    const filePath = path.join(dir, "shimmy");
    const data = Buffer.from("shimmy-binary");
    const digest = `sha256:${createHash("sha256").update(data).digest("hex")}`;

    await writeFile(filePath, data);
    await expect(readVerifiedRuntimeFile(filePath, digest)).resolves.toEqual(data);

    await writeFile(filePath, "tampered");
    await expect(readVerifiedRuntimeFile(filePath, digest)).rejects.toThrow(
      /Checksum mismatch/,
    );
  });

  it("rejects concurrent runtime write operations", async () => {
    let releaseFirstOperation: (() => void) | undefined;
    const operationStarted = vi.fn();
    const firstOperation = withRuntimeOperationLock("install", () =>
      new Promise((resolve) => {
        operationStarted();
        releaseFirstOperation = () => resolve("installed");
      }),
    );

    await vi.waitFor(() => expect(operationStarted).toHaveBeenCalledTimes(1));
    await expect(withRuntimeOperationLock("rollback", async () => "rolled back")).rejects.toBeInstanceOf(
      RuntimeOperationBusyError,
    );

    releaseFirstOperation?.();
    await expect(firstOperation).resolves.toBe("installed");
    await expect(withRuntimeOperationLock("rollback", async () => "rolled back")).resolves.toBe(
      "rolled back",
    );
  });

  it("caches latest release metadata briefly", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        tag_name: "v2.0.1",
        assets: [
          {
            name: "shimmy-macos-arm64",
            browser_download_url: "https://example.test/shimmy",
            digest: "sha256:abc",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await latestShimmyRelease();
    const second = await latestShimmyRelease();

    expect(first.tagName).toBe("v2.0.1");
    expect(second.tagName).toBe("v2.0.1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
