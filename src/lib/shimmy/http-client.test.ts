import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverModels, readHealth, readMetrics, readModels } from "./http-client";

describe("shimmy HTTP client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads health from the actual /health route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: "ok",
          service: "shimmy",
          version: "2.0.1",
          models: { total: 2, discovered: 1, manual: 1 },
        }),
      })),
    );

    await expect(readHealth("127.0.0.1:11435")).resolves.toMatchObject({
      ok: true,
      endpoint: "http://127.0.0.1:11435/health",
      modelsTotal: 2,
    });
  });

  it("posts to /api/models/discover", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [{ name: "tiny", source: "discovered" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(discoverModels("127.0.0.1:11435")).resolves.toEqual([
      { name: "tiny", source: "discovered" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:11435/api/models/discover",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("normalizes model and metrics payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [
              {
                name: "tiny",
                source: "registered",
                size_bytes: 1000,
                model_type: "Llama",
                parameter_count: "1B",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            gpu_detected: true,
            gpu_vendor: "apple",
            models: { total_size_mb: 638 },
            system: { memory_total_mb: 100, memory_free_mb: 20, memory_available_mb: 50 },
          }),
        }),
    );

    await expect(readModels("127.0.0.1:11435")).resolves.toEqual([
      {
        name: "tiny",
        source: "registered",
        sizeBytes: 1000,
        modelType: "Llama",
        parameterCount: "1B",
      },
    ]);
    await expect(readMetrics("127.0.0.1:11435")).resolves.toMatchObject({
      ok: true,
      gpuDetected: true,
      gpuVendor: "apple",
      memoryAvailableMb: 50,
    });
  });
});
