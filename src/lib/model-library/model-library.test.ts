import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compatibleCatalogModels } from "./catalog";
import { isGgufBuffer, readGgufMetadata } from "./gguf";
import {
  deleteManagedModel,
  downloadCatalogModel,
  importLocalGguf,
  listManagedModels,
  managedModelsDir,
  renameManagedModel,
} from "./model-store";
import {
  deleteOllamaModel,
  listOllamaModels,
  pullOllamaModel,
  readOllamaStatus,
  searchOllamaCatalog,
} from "./ollama";
import type { ShimmyUiConfig } from "@/lib/shimmy/types";

const ggufFixture = Buffer.concat([
  Buffer.from("GGUF"),
  Buffer.from([3, 0, 0, 0, 0, 0, 0, 0]),
  Buffer.from("fixture"),
]);

function testConfig(): ShimmyUiConfig {
  return {
    bindAddress: "127.0.0.1:11435",
    modelDirs: [],
    gpuBackend: "auto",
    language: "zh",
    theme: "dark",
  };
}

describe("model library core", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only GGUF buffers for Shimmy-managed models", async () => {
    expect(isGgufBuffer(ggufFixture)).toBe(true);
    expect(isGgufBuffer(Buffer.from("not gguf"))).toBe(false);

    const dir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-gguf-"));
    const filePath = path.join(dir, "tiny.gguf");
    await writeFile(filePath, ggufFixture);

    await expect(readGgufMetadata(filePath)).resolves.toMatchObject({
      path: filePath,
      valid: true,
      version: 3,
    });
  });

  it("filters the built-in catalog to compatible GGUF entries", () => {
    const models = compatibleCatalogModels([
      {
        id: "tiny",
        name: "Tiny GGUF",
        family: "llama",
        architecture: "llama",
        quantization: "Q4_K_M",
        sizeBytes: 12,
        url: "https://example.test/tiny.gguf",
        sha256: "0".repeat(64),
        license: "Apache-2.0",
        compatibility: { format: "gguf", shimmyProbeKnownGood: true },
      },
      {
        id: "other",
        name: "Other",
        family: "other",
        architecture: "other",
        quantization: "fp16",
        sizeBytes: 12,
        url: "https://example.test/other.bin",
        sha256: "0".repeat(64),
        license: "unknown",
        compatibility: { format: "other", shimmyProbeKnownGood: false },
      },
      {
        id: "missing-checksum",
        name: "Missing checksum",
        family: "llama",
        architecture: "llama",
        quantization: "Q4_K_M",
        sizeBytes: 12,
        url: "https://example.test/missing.gguf",
        sha256: "",
        license: "Apache-2.0",
        compatibility: { format: "gguf", shimmyProbeKnownGood: true },
      },
    ]);

    expect(models.map((item) => item.id)).toEqual(["tiny"]);
  });

  it("searches downloadable catalog models by name, family, architecture, and quantization", () => {
    const models = compatibleCatalogModels([
      {
        id: "tiny-q2",
        name: "Tiny GGUF Q2",
        family: "llama",
        architecture: "llama",
        quantization: "Q2_K",
        sizeBytes: 12,
        url: "https://example.test/tiny-q2.gguf",
        sha256: "1".repeat(64),
        license: "Apache-2.0",
        compatibility: { format: "gguf", shimmyProbeKnownGood: true },
      },
      {
        id: "qwen-q4",
        name: "Qwen Small GGUF",
        family: "qwen",
        architecture: "qwen2",
        quantization: "Q4_K_M",
        sizeBytes: 12,
        url: "https://example.test/qwen-q4.gguf",
        sha256: "2".repeat(64),
        license: "Apache-2.0",
        compatibility: { format: "gguf", shimmyProbeKnownGood: true },
      },
    ], "qwen q4");

    expect(models.map((item) => item.id)).toEqual(["qwen-q4"]);
  });

  it("imports local GGUF files into the managed model directory and registers it", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-source-"));
    const source = path.join(sourceDir, "Tiny Model.gguf");
    await writeFile(source, ggufFixture);

    let config = testConfig();
    const result = await importLocalGguf({
      sourcePath: source,
      shimmyUiHome: () => home,
      readConfig: async () => config,
      writeConfig: async (next) => {
        config = next;
        return config;
      },
    });

    expect(result.ok).toBe(true);
    expect(result.model.path).toContain(path.join(home, "models", "imported"));
    expect(result.model.path).toMatch(/tiny-model\.gguf$/);
    expect(await readFile(result.model.path)).toEqual(ggufFixture);
    expect(config.modelDirs).toContain(managedModelsDir(() => home));
  });

  it("deletes managed model files and clears matching metadata", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-source-"));
    const source = path.join(sourceDir, "Delete Me.gguf");
    await writeFile(source, ggufFixture);

    const imported = await importLocalGguf({
      sourcePath: source,
      shimmyUiHome: () => home,
      readConfig: async () => testConfig(),
      writeConfig: async (next) => next,
    });

    await expect(
      deleteManagedModel({
        name: imported.model.name,
        shimmyUiHome: () => home,
      }),
    ).resolves.toEqual({ ok: true, deleted: imported.model.name });
    await expect(listManagedModels(() => home)).resolves.toEqual([]);
    await expect(stat(imported.model.path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("renames managed model files and metadata", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-source-"));
    const source = path.join(sourceDir, "Rename Me.gguf");
    await writeFile(source, ggufFixture);

    const imported = await importLocalGguf({
      sourcePath: source,
      shimmyUiHome: () => home,
      readConfig: async () => testConfig(),
      writeConfig: async (next) => next,
    });
    const renamed = await renameManagedModel({
      name: imported.model.name,
      nextName: "better-name.gguf",
      shimmyUiHome: () => home,
    });

    expect(renamed.model.name).toBe("better-name.gguf");
    expect(renamed.model.path).toMatch(/better-name\.gguf$/);
    await expect(readFile(renamed.model.path)).resolves.toEqual(ggufFixture);
    await expect(stat(imported.model.path)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(listManagedModels(() => home)).resolves.toEqual([
      expect.objectContaining({ name: "better-name.gguf" }),
    ]);
  });

  it("removes local imports and skips metadata when Shimmy probe fails", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-source-"));
    const source = path.join(sourceDir, "Broken Model.gguf");
    await writeFile(source, ggufFixture);
    let config = testConfig();

    await expect(
      importLocalGguf({
        sourcePath: source,
        shimmyUiHome: () => home,
        readConfig: async () => config,
        writeConfig: async (next) => {
          config = next;
          return config;
        },
        probeModel: vi.fn(async () => ({ ok: false, output: "unsupported architecture" })),
      }),
    ).rejects.toThrow("Shimmy probe failed");

    await expect(listManagedModels(() => home)).resolves.toEqual([]);
    expect(config.modelDirs).toEqual([]);
    await expect(
      stat(path.join(home, "models", "imported", "broken-model.gguf")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects local imports that are not GGUF", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const source = path.join(home, "bad.bin");
    await writeFile(source, "not gguf");

    await expect(
      importLocalGguf({
        sourcePath: source,
        shimmyUiHome: () => home,
        readConfig: async () => testConfig(),
        writeConfig: async (next) => next,
      }),
    ).rejects.toThrow("not a GGUF file");
  });

  it("downloads catalog GGUF files with checksum verification", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const digest = await crypto.subtle.digest("SHA-256", ggufFixture);
    const sha256 = Buffer.from(digest).toString("hex");
    let config = testConfig();
    const fetchMock = vi.fn(async () => new Response(ggufFixture));

    const result = await downloadCatalogModel({
      model: {
        id: "tiny",
        name: "Tiny GGUF",
        family: "llama",
        architecture: "llama",
        quantization: "Q4_K_M",
        sizeBytes: ggufFixture.length,
        url: "https://example.test/tiny.gguf",
        sha256,
        license: "Apache-2.0",
        compatibility: { format: "gguf", shimmyProbeKnownGood: true },
      },
      shimmyUiHome: () => home,
      readConfig: async () => config,
      writeConfig: async (next) => {
        config = next;
        return config;
      },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/tiny.gguf", expect.any(Object));
    expect(result.model.path).toMatch(/tiny\.gguf$/);
    expect(config.modelDirs).toContain(managedModelsDir(() => home));
    await expect(listManagedModels(() => home)).resolves.toEqual([
      expect.objectContaining({ name: "tiny.gguf" }),
    ]);
  });

  it("removes catalog downloads and skips metadata when Shimmy probe fails", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const digest = await crypto.subtle.digest("SHA-256", ggufFixture);
    const sha256 = Buffer.from(digest).toString("hex");
    let config = testConfig();

    await expect(
      downloadCatalogModel({
        model: {
          id: "broken",
          name: "Broken GGUF",
          family: "llama",
          architecture: "llama",
          quantization: "Q4_K_M",
          sizeBytes: ggufFixture.length,
          url: "https://example.test/broken.gguf",
          sha256,
          license: "Apache-2.0",
          compatibility: { format: "gguf", shimmyProbeKnownGood: true },
        },
        shimmyUiHome: () => home,
        readConfig: async () => config,
        writeConfig: async (next) => {
          config = next;
          return config;
        },
        fetchImpl: vi.fn(async () => new Response(ggufFixture)),
        probeModel: vi.fn(async () => ({ ok: false, output: "load failed" })),
      }),
    ).rejects.toThrow("Shimmy probe failed");

    await expect(listManagedModels(() => home)).resolves.toEqual([]);
    expect(config.modelDirs).toEqual([]);
    await expect(
      stat(path.join(home, "models", "catalog", "broken.gguf")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects catalog downloads that do not have a sha256 checksum", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const fetchMock = vi.fn(async () => new Response(ggufFixture));

    await expect(
      downloadCatalogModel({
        model: {
          id: "unchecked",
          name: "Unchecked GGUF",
          family: "llama",
          architecture: "llama",
          quantization: "Q4_K_M",
          sizeBytes: ggufFixture.length,
          url: "https://example.test/unchecked.gguf",
          sha256: "",
          license: "Apache-2.0",
          compatibility: { format: "gguf", shimmyProbeKnownGood: true },
        },
        shimmyUiHome: () => home,
        readConfig: async () => testConfig(),
        writeConfig: async (next) => next,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("missing a sha256 checksum");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports Ollama status and hides non-GGUF models from importable results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: "0.12.3" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              { name: "llama3.2:latest", size: 123, details: { family: "llama" } },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            details: { format: "gguf", family: "llama", quantization_level: "Q4_K_M" },
            capabilities: ["completion"],
          }),
        ),
      );

    await expect(readOllamaStatus({ fetchImpl: fetchMock })).resolves.toEqual({
      installed: true,
      running: true,
      version: "0.12.3",
      baseUrl: "http://127.0.0.1:11434",
    });
    await expect(listOllamaModels({ fetchImpl: fetchMock })).resolves.toEqual([
      expect.objectContaining({
        name: "llama3.2:latest",
        importable: true,
        format: "gguf",
      }),
    ]);
  });

  it("reads Ollama base URL from SHIMMY_UI_OLLAMA_BASE_URL", async () => {
    vi.stubEnv("SHIMMY_UI_OLLAMA_BASE_URL", "http://ollama.internal:11434");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: "0.12.3" })));

    await expect(readOllamaStatus({ fetchImpl: fetchMock })).resolves.toMatchObject({
      running: true,
      baseUrl: "http://ollama.internal:11434",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://ollama.internal:11434/api/version",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("searches recommended Ollama models and pulls/deletes through the local API", async () => {
    expect(searchOllamaCatalog("qwen 1.5").map((item) => item.name)).toContain("qwen2.5:1.5b");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "success" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            details: { format: "gguf" },
            capabilities: ["completion"],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      pullOllamaModel({ model: "qwen2.5:1.5b", fetchImpl: fetchMock }),
    ).resolves.toEqual({ ok: true, model: "qwen2.5:1.5b" });
    await expect(
      deleteOllamaModel({ model: "qwen2.5:1.5b", fetchImpl: fetchMock }),
    ).resolves.toEqual({ ok: true, deleted: "qwen2.5:1.5b" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:11434/api/pull",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ model: "qwen2.5:1.5b", stream: false }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:11434/api/show",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ model: "qwen2.5:1.5b" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:11434/api/delete",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ model: "qwen2.5:1.5b" }),
      }),
    );
  });

  it("auto-removes Ollama models that are not Shimmy-compatible", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "success" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            details: { format: "safetensors" },
            capabilities: ["chat"],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      pullOllamaModel({ model: "not-supported", fetchImpl: fetchMock }),
    ).rejects.toThrow("not a GGUF completion model compatible with Shimmy");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:11434/api/delete",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ model: "not-supported" }),
      }),
    );
  });

  it("reports Ollama as not running when the API is unreachable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const execFileMock = vi.fn(async () => ({
      stdout: "ollama version is 0.12.3",
      stderr: "",
    }));

    await expect(
      readOllamaStatus({
        fetchImpl: fetchMock,
        execFileImpl: execFileMock,
      }),
    ).resolves.toMatchObject({
      installed: true,
      running: false,
      version: "0.12.3",
      error: "connect ECONNREFUSED",
    });
  });
});
