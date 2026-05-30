import { afterEach, describe, expect, it, vi } from "vitest";

describe("API contract boundaries", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/shimmy/runtime-manager");
    vi.doUnmock("@/lib/shimmy/config-store");
    vi.doUnmock("@/lib/shimmy/process-manager");
    vi.doUnmock("@/lib/shimmy/http-client");
    vi.doUnmock("@/lib/shimmy/binary");
    vi.doUnmock("@/lib/shimmy/model-dirs");
    vi.doUnmock("@/lib/shimmy/runtime");
    vi.doUnmock("@/lib/model-library/catalog");
    vi.doUnmock("@/lib/model-library/model-store");
    vi.doUnmock("@/lib/model-library/ollama");
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns 409 when a runtime operation is already active", async () => {
    class TestRuntimeOperationBusyError extends Error {
      constructor() {
        super('Runtime operation "install" is already running');
        this.name = "RuntimeOperationBusyError";
      }
    }

    vi.doMock("@/lib/shimmy/runtime-manager", () => ({
      RuntimeOperationBusyError: TestRuntimeOperationBusyError,
      downloadRuntime: vi.fn(async () => {
        throw new TestRuntimeOperationBusyError();
      }),
    }));

    const route = await import("./runtime/download/route");
    const response = await route.POST();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ ok: false });
    expect(body.error).toContain("already running");
  });

  it("returns 400 for invalid settings payloads", async () => {
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        write: vi.fn(async () => {
          throw new Error("maxCtx must be between 512 and 131072");
        }),
      },
    }));

    const route = await import("./app/settings/route");
    const response = await route.POST(
      new Request("http://shimmy.test/api/app/settings", {
        method: "POST",
        body: JSON.stringify({ maxCtx: 1 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "maxCtx must be between 512 and 131072",
    });
  });

  it("returns 502 when the chat proxy cannot reach Shimmy", async () => {
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
      },
    }));
    vi.doMock("@/lib/shimmy/http-client", () => ({
      shimmyBaseUrl: () => "http://127.0.0.1:11435",
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 502, statusText: "Bad Gateway" })),
    );

    const route = await import("./chat/route");
    const response = await route.POST(
      new Request("http://shimmy.test/api/chat", {
        method: "POST",
        body: JSON.stringify({ model: "tinyllama-1.1b", messages: [] }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Shimmy chat request failed: 502 Bad Gateway");
  });

  it("rejects oversized chat proxy bodies", async () => {
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
      },
    }));

    const route = await import("./chat/route");
    const response = await route.POST(
      new Request("http://shimmy.test/api/chat", {
        method: "POST",
        body: "x".repeat(262_145),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toBe("Chat request body is too large");
  });

  it("returns 504 when the chat proxy times out", async () => {
    vi.stubEnv("SHIMMY_UI_CHAT_TIMEOUT_MS", "20");
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
      },
    }));
    vi.doMock("@/lib/shimmy/http-client", () => ({
      shimmyBaseUrl: () => "http://127.0.0.1:11435",
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init?: RequestInit) => {
        await new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }),
    );

    const route = await import("./chat/route");
    const response = await route.POST(
      new Request("http://shimmy.test/api/chat", {
        method: "POST",
        body: JSON.stringify({ model: "tinyllama-1.1b", messages: [] }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toBe("Shimmy chat request timed out");
  });

  it("clears logs through the logs API", async () => {
    const clear = vi.fn();
    vi.doMock("@/lib/shimmy/process-manager", () => ({
      shimmyProcessManager: {
        logs: {
          list: vi.fn(() => [
            {
              id: 1,
              time: "2026-05-29T00:00:00.000Z",
              stream: "stderr",
              message: "failed",
            },
          ]),
          clear,
        },
      },
    }));

    const route = await import("./shimmy/logs/route");
    const listResponse = await route.GET();
    const listBody = await listResponse.json();
    const deleteResponse = await route.DELETE();
    const deleteBody = await deleteResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.logs).toHaveLength(1);
    expect(clear).toHaveBeenCalledOnce();
    expect(deleteResponse.status).toBe(200);
    expect(deleteBody).toEqual({ ok: true });
  });

  it("surfaces health and metrics failures in app status", async () => {
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
      },
    }));
    vi.doMock("@/lib/shimmy/binary", () => ({
      detectShimmyBinary: vi.fn(async () => ({ selected: null, candidates: [] })),
    }));
    vi.doMock("@/lib/shimmy/http-client", () => ({
      readHealth: vi.fn(async () => ({
        ok: false,
        endpoint: "http://127.0.0.1:11435/health",
        error: "503 Service Unavailable",
      })),
      readMetrics: vi.fn(async () => ({
        ok: false,
        error: "ECONNREFUSED",
      })),
    }));
    vi.doMock("@/lib/shimmy/model-dirs", () => ({
      inspectModelDirectories: vi.fn(async () => ({
        configured: false,
        directories: [],
        totalGgufFiles: 0,
        hasReadableDirectory: false,
        hasModels: false,
      })),
    }));
    vi.doMock("@/lib/shimmy/process-manager", () => ({
      shimmyProcessManager: {
        pid: undefined,
        status: vi.fn(() => "missing-binary"),
        logs: { list: vi.fn(() => []) },
      },
    }));

    const route = await import("./app/status/route");
    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state).toBe("missing-binary");
    expect(body.health).toMatchObject({ ok: false, error: "503 Service Unavailable" });
    expect(body.metrics).toMatchObject({ ok: false, error: "ECONNREFUSED" });
  });

  it("returns 502 with an empty model list when models cannot be read", async () => {
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
      },
    }));
    vi.doMock("@/lib/shimmy/http-client", () => ({
      readModels: vi.fn(async () => {
        throw new Error("models endpoint unavailable");
      }),
    }));

    const route = await import("./shimmy/models/route");
    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      models: [],
      error: "models endpoint unavailable",
    });
  });

  it("returns 502 with an empty model list when discovery fails", async () => {
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
      },
    }));
    vi.doMock("@/lib/shimmy/http-client", () => ({
      discoverModels: vi.fn(async () => {
        throw new Error("discover endpoint unavailable");
      }),
    }));

    const route = await import("./shimmy/discover/route");
    const response = await route.POST();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      models: [],
      error: "discover endpoint unavailable",
    });
  });

  it("returns 404 when gpu-info has no executable Shimmy binary", async () => {
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
      },
    }));
    vi.doMock("@/lib/shimmy/binary", () => ({
      detectShimmyBinary: vi.fn(async () => ({ selected: null, candidates: [] })),
    }));

    const route = await import("./shimmy/gpu-info/route");
    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, error: "Shimmy binary not found" });
  });

  it("returns 500 when gpu-info execution fails", async () => {
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
      },
    }));
    vi.doMock("@/lib/shimmy/binary", () => ({
      detectShimmyBinary: vi.fn(async () => ({
        selected: {
          path: "/tmp/shimmy",
          exists: true,
          executable: true,
          source: "configured",
        },
        candidates: [],
      })),
    }));
    vi.doMock("@/lib/shimmy/runtime", () => ({
      runShimmyInfoCommand: vi.fn(async () => {
        throw new Error("gpu-info failed");
      }),
    }));

    const route = await import("./shimmy/gpu-info/route");
    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "gpu-info failed" });
  });

  it("returns compatible catalog models from the model library catalog API", async () => {
    const compatibleCatalogModels = vi.fn(() => [
      {
        id: "tiny",
        name: "Tiny GGUF",
        compatibility: { format: "gguf", shimmyProbeKnownGood: true },
      },
    ]);
    vi.doMock("@/lib/model-library/catalog", () => ({
      compatibleCatalogModels,
    }));

    const route = await import("./model-library/catalog/route");
    const response = await route.GET(
      new Request("http://shimmy.test/api/model-library/catalog?q=tiny"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(compatibleCatalogModels).toHaveBeenCalledWith(undefined, "tiny");
    expect(body).toEqual({
      ok: true,
      models: [
        {
          id: "tiny",
          name: "Tiny GGUF",
          compatibility: { format: "gguf", shimmyProbeKnownGood: true },
        },
      ],
    });
  });

  it("deletes managed model metadata through the model library API", async () => {
    const deleteManagedModel = vi.fn(async () => ({ ok: true, deleted: "tiny.gguf" }));
    vi.doMock("@/lib/model-library/model-store", () => ({
      deleteManagedModel,
    }));

    const route = await import("./model-library/installed/[name]/route");
    const response = await route.DELETE(
      new Request("http://shimmy.test/api/model-library/installed/tiny.gguf"),
      { params: Promise.resolve({ name: "tiny.gguf" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteManagedModel).toHaveBeenCalledWith({ name: "tiny.gguf" });
    expect(body).toEqual({ ok: true, deleted: "tiny.gguf" });
  });

  it("renames managed model metadata through the model library API", async () => {
    const renameManagedModel = vi.fn(async () => ({
      ok: true,
      model: { name: "better.gguf", path: "/tmp/better.gguf" },
    }));
    vi.doMock("@/lib/model-library/model-store", () => ({
      renameManagedModel,
    }));

    const route = await import("./model-library/installed/[name]/route");
    const response = await route.PATCH(
      new Request("http://shimmy.test/api/model-library/installed/tiny.gguf", {
        method: "PATCH",
        body: JSON.stringify({ name: "better.gguf" }),
      }),
      { params: Promise.resolve({ name: "tiny.gguf" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(renameManagedModel).toHaveBeenCalledWith({
      name: "tiny.gguf",
      nextName: "better.gguf",
    });
    expect(body.ok).toBe(true);
    expect(body.model.name).toBe("better.gguf");
  });

  it("imports local GGUF paths through the model library API", async () => {
    const probe = vi.fn(async () => ({ ok: true, output: "ok" }));
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
        write: vi.fn(async (config) => config),
      },
    }));
    vi.doMock("@/lib/shimmy/binary", () => ({
      detectShimmyBinary: vi.fn(async () => ({
        selected: {
          path: "/tmp/shimmy",
          exists: true,
          executable: true,
          source: "configured",
        },
        candidates: [],
      })),
    }));
    vi.doMock("@/lib/shimmy/process-manager", () => ({
      shimmyProcessManager: { probe },
    }));
    const importLocalGguf = vi.fn(async ({ probeModel }) => {
      await probeModel("tiny.gguf");
      return {
        ok: true,
        model: {
          name: "tiny.gguf",
          path: "/tmp/tiny.gguf",
          sizeBytes: 12,
          source: "local",
          importedAt: "2026-05-29T00:00:00.000Z",
        },
      };
    });
    vi.doMock("@/lib/model-library/model-store", () => ({
      importLocalGguf,
    }));

    const route = await import("./model-library/import-local/route");
    const response = await route.POST(
      new Request("http://shimmy.test/api/model-library/import-local", {
        method: "POST",
        body: JSON.stringify({ path: "/tmp/tiny.gguf" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.model.name).toBe("tiny.gguf");
    expect(probe).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/tmp/shimmy" }),
      "tiny.gguf",
    );
  });

  it("rejects missing local import paths", async () => {
    const route = await import("./model-library/import-local/route");
    const response = await route.POST(
      new Request("http://shimmy.test/api/model-library/import-local", {
        method: "POST",
        body: JSON.stringify({ path: "" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("downloads catalog models by id through the model library API", async () => {
    const probe = vi.fn(async () => ({ ok: true, output: "ok" }));
    vi.doMock("@/lib/shimmy/config-store", () => ({
      configStore: {
        read: vi.fn(async () => ({
          bindAddress: "127.0.0.1:11435",
          modelDirs: [],
          gpuBackend: "auto",
          language: "zh",
          theme: "dark",
        })),
        write: vi.fn(async (config) => config),
      },
    }));
    vi.doMock("@/lib/shimmy/binary", () => ({
      detectShimmyBinary: vi.fn(async () => ({
        selected: {
          path: "/tmp/shimmy",
          exists: true,
          executable: true,
          source: "configured",
        },
        candidates: [],
      })),
    }));
    vi.doMock("@/lib/shimmy/process-manager", () => ({
      shimmyProcessManager: { probe },
    }));
    vi.doMock("@/lib/model-library/catalog", () => ({
      catalogModels: [
        {
          id: "tiny",
          name: "Tiny GGUF",
          family: "llama",
          architecture: "llama",
          quantization: "Q4_K_M",
          sizeBytes: 12,
          url: "https://example.test/tiny.gguf",
          sha256: "",
          license: "Apache-2.0",
          compatibility: { format: "gguf", shimmyProbeKnownGood: true },
        },
      ],
    }));
    const downloadCatalogModel = vi.fn(async ({ probeModel }) => {
      await probeModel("tiny.gguf");
      return {
        ok: true,
        model: {
          name: "tiny.gguf",
          path: "/tmp/tiny.gguf",
          sizeBytes: 12,
          source: "catalog",
          importedAt: "2026-05-29T00:00:00.000Z",
        },
      };
    });
    vi.doMock("@/lib/model-library/model-store", () => ({
      downloadCatalogModel,
    }));

    const route = await import("./model-library/download/route");
    const response = await route.POST(
      new Request("http://shimmy.test/api/model-library/download", {
        method: "POST",
        body: JSON.stringify({ id: "tiny" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.model.source).toBe("catalog");
    expect(probe).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/tmp/shimmy" }),
      "tiny.gguf",
    );
  });

  it("returns Ollama status and models through model library APIs", async () => {
    vi.doMock("@/lib/model-library/ollama", () => ({
      readOllamaStatus: vi.fn(async () => ({
        installed: true,
        running: true,
        version: "0.12.3",
        baseUrl: "http://127.0.0.1:11434",
      })),
      listOllamaModels: vi.fn(async () => [
        {
          name: "llama3.2:latest",
          importable: true,
          format: "gguf",
        },
      ]),
    }));

    const statusRoute = await import("./model-library/ollama/status/route");
    const modelsRoute = await import("./model-library/ollama/models/route");
    const statusResponse = await statusRoute.GET();
    const modelsResponse = await modelsRoute.GET();

    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toMatchObject({
      ok: true,
      status: { running: true },
    });
    expect(modelsResponse.status).toBe(200);
    await expect(modelsResponse.json()).resolves.toMatchObject({
      ok: true,
      models: [{ name: "llama3.2:latest", importable: true }],
    });
  });

  it("searches and mutates Ollama models through model library APIs", async () => {
    const searchOllamaCatalog = vi.fn(() => [
      {
        name: "qwen2.5:1.5b",
        family: "qwen",
        sizeLabel: "1.5B",
        description: "small",
        tags: ["chat"],
      },
    ]);
    const pullOllamaModel = vi.fn(async () => ({ ok: true, model: "qwen2.5:1.5b" }));
    const deleteOllamaModel = vi.fn(async () => ({ ok: true, deleted: "qwen2.5:1.5b" }));
    vi.doMock("@/lib/model-library/ollama", () => ({
      searchOllamaCatalog,
      pullOllamaModel,
      deleteOllamaModel,
    }));

    const searchRoute = await import("./model-library/ollama/search/route");
    const pullRoute = await import("./model-library/ollama/pull/route");
    const deleteRoute = await import("./model-library/ollama/delete/route");
    const searchResponse = await searchRoute.GET(
      new Request("http://shimmy.test/api/model-library/ollama/search?q=qwen"),
    );
    const pullResponse = await pullRoute.POST(
      new Request("http://shimmy.test/api/model-library/ollama/pull", {
        method: "POST",
        body: JSON.stringify({ model: "qwen2.5:1.5b" }),
      }),
    );
    const deleteResponse = await deleteRoute.POST(
      new Request("http://shimmy.test/api/model-library/ollama/delete", {
        method: "POST",
        body: JSON.stringify({ model: "qwen2.5:1.5b" }),
      }),
    );

    expect(searchResponse.status).toBe(200);
    await expect(searchResponse.json()).resolves.toMatchObject({
      ok: true,
      models: [{ name: "qwen2.5:1.5b" }],
    });
    expect(searchOllamaCatalog).toHaveBeenCalledWith("qwen");
    expect(pullResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(pullOllamaModel).toHaveBeenCalledWith({ model: "qwen2.5:1.5b" });
    expect(deleteOllamaModel).toHaveBeenCalledWith({ model: "qwen2.5:1.5b" });
  });

  it("starts Ollama through the model library API", async () => {
    const startOllama = vi.fn(async () => ({ ok: true, started: true }));
    vi.doMock("@/lib/model-library/ollama", () => ({
      startOllama,
    }));

    const route = await import("./model-library/ollama/start/route");
    const response = await route.POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(startOllama).toHaveBeenCalledOnce();
    expect(body).toEqual({ ok: true, started: true });
  });
});
