import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compatibleCatalogModels } from "./catalog";
import { isGgufBuffer, readGgufMetadata } from "./gguf";
import {
  deleteManagedModel,
  downloadCatalogModel,
  downloadHuggingFaceGguf,
  importLocalGguf,
  listManagedModels,
  managedModelsDir,
  renameManagedModel,
  syncManagedModelDirsFromMetadata,
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

function safeManagedFileName(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/\.gguf$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized || "model"}.gguf`;
}

function huggingFaceManagedName(repoId: string, fileName: string) {
  return safeManagedFileName(`${repoId.replace(/[\\/]+/g, "--")}-${path.basename(fileName)}`);
}

function huggingFaceTempPath(home: string, repoId: string, fileName: string) {
  return path.join(home, "models", ".downloads", `${huggingFaceManagedName(repoId, fileName)}.partial`);
}

function requestHeader(init: RequestInit | undefined, name: string) {
  if (!init?.headers) return null;
  const key = name.toLowerCase();
  if (init.headers instanceof Headers) return init.headers.get(name);
  if (Array.isArray(init.headers)) {
    const found = init.headers.find(([header]) => header.toLowerCase() === key);
    return found?.[1] ?? null;
  }
  const headers = init.headers as Record<string, string>;
  return headers[name] ?? headers[key] ?? null;
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
    expect(config.modelDirs).toContain(path.join(home, "models", "imported"));
  });

  it("retries Shimmy probe with normalized managed model names", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-source-"));
    const source = path.join(sourceDir, "My_Q4_K_M.gguf");
    await writeFile(source, ggufFixture);
    let config = testConfig();
    const probeModel = vi.fn(async (modelName: string) => {
      if (modelName === "my-q4-k-m") return { ok: true, output: "ok" };
      return { ok: false, output: `Error: no model ${modelName}` };
    });

    await expect(
      importLocalGguf({
        sourcePath: source,
        shimmyUiHome: () => home,
        readConfig: async () => config,
        writeConfig: async (next) => {
          config = next;
          return config;
        },
        probeModel,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(probeModel).toHaveBeenNthCalledWith(1, "my_q4_k_m.gguf");
    expect(probeModel).toHaveBeenNthCalledWith(2, "my_q4_k_m");
    expect(probeModel).toHaveBeenNthCalledWith(3, "my-q4-k-m");
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
    expect(config.modelDirs).toContain(path.join(home, "models", "catalog"));
    await expect(listManagedModels(() => home)).resolves.toEqual([
      expect.objectContaining({ name: "tiny.gguf" }),
    ]);
  });

  it("downloads Hugging Face GGUF files via stream and reports progress", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    let config = testConfig();
    const progress: Array<{ phase: string; downloadedBytes: number; totalBytes?: number }> = [];
    const fetchMock = vi.fn(async () =>
      new Response(ggufFixture, {
        headers: {
          "content-length": String(ggufFixture.length),
        },
      }),
    );

    const result = await downloadHuggingFaceGguf({
      repoId: "unsloth/Qwen3.5-9B-GGUF",
      fileName: "Qwen3.5-9B-Q4_K_M.gguf",
      downloadUrl: "https://example.test/qwen.gguf",
      shimmyUiHome: () => home,
      readConfig: async () => config,
      writeConfig: async (next) => {
        config = next;
        return config;
      },
      fetchImpl: fetchMock,
      onProgress: (event) => {
        progress.push({
          phase: event.phase,
          downloadedBytes: event.downloadedBytes,
          totalBytes: event.totalBytes,
        });
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/qwen.gguf", expect.any(Object));
    expect(result.model.source).toBe("huggingface");
    expect(result.model.path).toContain(path.join(home, "models", "huggingface"));
    expect(config.modelDirs).toContain(managedModelsDir(() => home));
    expect(config.modelDirs).toContain(path.join(home, "models", "huggingface"));
    expect(progress.some((item) => item.phase === "downloading")).toBe(true);
    expect(progress.some((item) => item.phase === "validating")).toBe(true);
    expect(progress.some((item) => item.phase === "done")).toBe(true);
    expect(progress[progress.length - 1]).toMatchObject({
      phase: "done",
      downloadedBytes: ggufFixture.length,
    });
  });

  it("resumes Hugging Face download from partial bytes when server returns 206", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    let config = testConfig();
    const repoId = "unsloth/Qwen3.5-9B-GGUF";
    const fileName = "Qwen3.5-9B-Q4_K_M.gguf";
    const tempPath = huggingFaceTempPath(home, repoId, fileName);
    const prefix = ggufFixture.subarray(0, 4);
    await mkdir(path.dirname(tempPath), { recursive: true });
    await writeFile(tempPath, prefix);
    const remaining = ggufFixture.subarray(prefix.length);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(requestHeader(init, "range")).toBe(`bytes=${prefix.length}-`);
      return new Response(remaining, {
        status: 206,
        headers: {
          "content-length": String(remaining.length),
          "content-range": `bytes ${prefix.length}-${ggufFixture.length - 1}/${ggufFixture.length}`,
        },
      });
    });

    const result = await downloadHuggingFaceGguf({
      repoId,
      fileName,
      downloadUrl: "https://example.test/qwen.gguf",
      shimmyUiHome: () => home,
      readConfig: async () => config,
      writeConfig: async (next) => {
        config = next;
        return config;
      },
      fetchImpl: fetchMock,
    });

    expect(result.model.path).toContain(path.join(home, "models", "huggingface"));
    await expect(readFile(result.model.path)).resolves.toEqual(ggufFixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to full re-download when Range request returns 200", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const repoId = "unsloth/Qwen3.5-9B-GGUF";
    const fileName = "Qwen3.5-9B-Q4_K_M.gguf";
    const tempPath = huggingFaceTempPath(home, repoId, fileName);
    await mkdir(path.dirname(tempPath), { recursive: true });
    await writeFile(tempPath, ggufFixture.subarray(0, 4));
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(requestHeader(init, "range")).toBe("bytes=4-");
      return new Response(ggufFixture, {
        status: 200,
        headers: {
          "content-length": String(ggufFixture.length),
        },
      });
    });

    const result = await downloadHuggingFaceGguf({
      repoId,
      fileName,
      downloadUrl: "https://example.test/qwen.gguf",
      shimmyUiHome: () => home,
      readConfig: async () => testConfig(),
      writeConfig: async (next) => next,
      fetchImpl: fetchMock,
    });

    await expect(readFile(result.model.path)).resolves.toEqual(ggufFixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips transfer and validates local partial when Range request returns 416 with matching total", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const repoId = "unsloth/Qwen3.5-9B-GGUF";
    const fileName = "Qwen3.5-9B-Q4_K_M.gguf";
    const tempPath = huggingFaceTempPath(home, repoId, fileName);
    await mkdir(path.dirname(tempPath), { recursive: true });
    await writeFile(tempPath, ggufFixture);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(requestHeader(init, "range")).toBe(`bytes=${ggufFixture.length}-`);
      return new Response(null, {
        status: 416,
        statusText: "Range Not Satisfiable",
        headers: {
          "content-range": `bytes */${ggufFixture.length}`,
        },
      });
    });

    const result = await downloadHuggingFaceGguf({
      repoId,
      fileName,
      downloadUrl: "https://example.test/qwen.gguf",
      shimmyUiHome: () => home,
      readConfig: async () => testConfig(),
      writeConfig: async (next) => next,
      fetchImpl: fetchMock,
    });

    await expect(readFile(result.model.path)).resolves.toEqual(ggufFixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("repairs legacy managed model directories from metadata paths", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const legacyDir = path.join(home, "models", "huggingface");
    const legacyPath = path.join(legacyDir, "legacy.gguf");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(legacyPath, ggufFixture);
    await writeFile(
      path.join(home, "models", "models.json"),
      `${JSON.stringify(
        [
          {
            name: "legacy.gguf",
            path: legacyPath,
            sizeBytes: ggufFixture.length,
            source: "huggingface",
            importedAt: "2026-05-30T00:00:00.000Z",
          },
        ],
        null,
        2,
      )}\n`,
    );

    let config = {
      ...testConfig(),
      modelDirs: [path.join(home, "models")],
    };
    const sync = await syncManagedModelDirsFromMetadata({
      shimmyUiHome: () => home,
      readConfig: async () => config,
      writeConfig: async (next) => {
        config = next;
        return config;
      },
    });

    expect(sync.updated).toBe(true);
    expect(sync.addedDirs).toContain(path.join(home, "models", "huggingface"));
    expect(config.modelDirs).toContain(path.join(home, "models", "huggingface"));
  });

  it("keeps partial file when transfer stage fails to allow next resume", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "shimmy-ui-model-home-"));
    const repoId = "unsloth/Qwen3.5-9B-GGUF";
    const fileName = "Qwen3.5-9B-Q4_K_M.gguf";
    const tempPath = huggingFaceTempPath(home, repoId, fileName);
    const existingPartial = ggufFixture.subarray(0, 4);
    await mkdir(path.dirname(tempPath), { recursive: true });
    await writeFile(tempPath, existingPartial);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("socket closed"));
      },
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(requestHeader(init, "range")).toBe(`bytes=${existingPartial.length}-`);
      return new Response(stream, {
        status: 206,
        headers: {
          "content-length": "1",
          "content-range": `bytes ${existingPartial.length}-${ggufFixture.length - 1}/${ggufFixture.length}`,
        },
      });
    });

    await expect(
      downloadHuggingFaceGguf({
        repoId,
        fileName,
        downloadUrl: "https://example.test/qwen.gguf",
        shimmyUiHome: () => home,
        readConfig: async () => testConfig(),
        writeConfig: async (next) => next,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("socket closed");

    await expect(readFile(tempPath)).resolves.toEqual(existingPartial);
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
