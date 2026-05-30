import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { defaultConfig } from "@/lib/shimmy/config";
import type { ShimmyUiConfig } from "@/lib/shimmy/types";
import { readGgufMetadata } from "./gguf";
import type { CatalogModel, ManagedModel } from "./types";

type ConfigAccess = {
  readConfig?: () => Promise<ShimmyUiConfig>;
  writeConfig?: (config: ShimmyUiConfig) => Promise<ShimmyUiConfig>;
};

type HomeAccess = {
  shimmyUiHome?: () => string;
};

type ProbeAccess = {
  probeModel?: (modelName: string) => Promise<{ ok: boolean; output: string }>;
};

export type ModelDownloadPhase = "downloading" | "validating" | "probing" | "done";

export type ModelDownloadProgress = {
  phase: ModelDownloadPhase;
  downloadedBytes: number;
  totalBytes?: number;
};

type ProgressAccess = {
  onProgress?: (progress: ModelDownloadProgress) => void;
};

type ModelDirSyncResult = {
  updated: boolean;
  addedDirs: string[];
};

function defaultShimmyUiHome() {
  return process.env.SHIMMY_UI_HOME || path.join(os.homedir(), ".shimmy-ui");
}

export function managedModelsDir(shimmyUiHome = defaultShimmyUiHome) {
  return path.join(shimmyUiHome(), "models");
}

function metadataPath(shimmyUiHome = defaultShimmyUiHome) {
  return path.join(managedModelsDir(shimmyUiHome), "models.json");
}

function safeModelFileName(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/\.gguf$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized || "model"}.gguf`;
}

async function readManagedModels(shimmyUiHome = defaultShimmyUiHome): Promise<ManagedModel[]> {
  try {
    return JSON.parse(await readFile(metadataPath(shimmyUiHome), "utf8")) as ManagedModel[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeManagedModels(models: ManagedModel[], shimmyUiHome = defaultShimmyUiHome) {
  await mkdir(managedModelsDir(shimmyUiHome), { recursive: true });
  await writeFile(metadataPath(shimmyUiHome), `${JSON.stringify(models, null, 2)}\n`, "utf8");
}

async function readManagedModelByName(name: string, shimmyUiHome = defaultShimmyUiHome) {
  const models = await readManagedModels(shimmyUiHome);
  return models.find((model) => model.name === name);
}

function uniqueNormalizedDirs(dirs: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const dir of dirs) {
    const trimmed = dir.trim();
    if (!trimmed) continue;
    const normalized = path.resolve(trimmed);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(trimmed);
  }
  return unique;
}

async function ensureModelDirsRegistered(
  { readConfig, writeConfig }: ConfigAccess,
  candidateDirs: string[],
): Promise<ModelDirSyncResult> {
  if (!readConfig || !writeConfig) return { updated: false, addedDirs: [] };
  const config = await readConfig();
  const existing = new Set(config.modelDirs.map((dir) => path.resolve(dir)));
  const addedDirs = uniqueNormalizedDirs(candidateDirs).filter((dir) => !existing.has(path.resolve(dir)));
  if (addedDirs.length === 0) return { updated: false, addedDirs: [] };
  await writeConfig({
    ...config,
    modelDirs: [...addedDirs, ...config.modelDirs],
  });
  return { updated: true, addedDirs };
}

async function ensureManagedDirRegistered(
  { readConfig, writeConfig }: ConfigAccess,
  shimmyUiHome = defaultShimmyUiHome,
  requiredDirs: string[] = [],
): Promise<ModelDirSyncResult> {
  const managedDir = managedModelsDir(shimmyUiHome);
  return ensureModelDirsRegistered({ readConfig, writeConfig }, [managedDir, ...requiredDirs]);
}

async function recordManagedModel(model: ManagedModel, shimmyUiHome = defaultShimmyUiHome) {
  const models = await readManagedModels(shimmyUiHome);
  await writeManagedModels(
    [model, ...models.filter((item) => item.path !== model.path && item.name !== model.name)],
    shimmyUiHome,
  );
  return model;
}

async function assertGguf(filePath: string) {
  const metadata = await readGgufMetadata(filePath);
  if (!metadata.valid) {
    throw new Error(`${filePath} is not a GGUF file`);
  }
  return metadata;
}

async function assertShimmyProbe(
  modelName: string,
  probeModel?: ProbeAccess["probeModel"],
) {
  if (!probeModel) return;
  const stripped = modelName.replace(/\.gguf$/i, "");
  const candidates = Array.from(
    new Set([modelName, stripped, stripped.replace(/_/g, "-")].filter((item) => item.length > 0)),
  );
  let lastOutput = "";
  for (const candidate of candidates) {
    const result = await probeModel(candidate);
    if (result.ok) {
      return;
    }
    lastOutput = result.output ?? "";
    const hint = lastOutput.toLowerCase();
    if (!hint.includes("no model") && !hint.includes("not found")) {
      break;
    }
  }
  const output = lastOutput ? `: ${lastOutput}` : "";
  throw new Error(`Shimmy probe failed for ${modelName}${output}`);
}

async function removeFileIfPresent(filePath: string) {
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

function parseContentLength(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseContentRangeTotal(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = value.match(/\/(\d+)$/);
  if (!match?.[1]) return undefined;
  const total = Number.parseInt(match[1], 10);
  if (!Number.isFinite(total) || total <= 0) return undefined;
  return total;
}

async function fileSizeIfPresent(filePath: string) {
  try {
    const info = await stat(filePath);
    return info.isFile() ? info.size : 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

async function streamResponseToFile({
  response,
  tempPath,
  hash,
  onProgress,
  append = false,
  initialDownloadedBytes = 0,
  totalBytes: providedTotalBytes,
}: {
  response: Response;
  tempPath: string;
  hash?: ReturnType<typeof createHash>;
  append?: boolean;
  initialDownloadedBytes?: number;
  totalBytes?: number;
} & ProgressAccess) {
  if (!response.body) {
    throw new Error("Model download failed: response body is empty");
  }
  const contentRangeTotal = parseContentRangeTotal(response.headers.get("content-range"));
  const contentLength = parseContentLength(response.headers.get("content-length"));
  const totalBytes =
    providedTotalBytes ??
    contentRangeTotal ??
    (typeof contentLength === "number" ? initialDownloadedBytes + contentLength : undefined);
  let downloadedBytes = initialDownloadedBytes;
  let lastReportedBytes = downloadedBytes;
  let lastReportedAt = 0;
  onProgress?.({ phase: "downloading", downloadedBytes, totalBytes });

  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloadedBytes += chunk.length;
      hash?.update(chunk);
      const now = Date.now();
      const advancedBytes = downloadedBytes - lastReportedBytes;
      if (advancedBytes >= 4 * 1024 * 1024 || now - lastReportedAt >= 800) {
        onProgress?.({ phase: "downloading", downloadedBytes, totalBytes });
        lastReportedBytes = downloadedBytes;
        lastReportedAt = now;
      }
      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
    counter,
    createWriteStream(tempPath, { flags: append ? "a" : "w" }),
  );
  onProgress?.({ phase: "downloading", downloadedBytes, totalBytes });
  return { downloadedBytes, totalBytes };
}

export async function listManagedModels(shimmyUiHome = defaultShimmyUiHome) {
  const models = await readManagedModels(shimmyUiHome);
  const existing = await Promise.all(
    models.map(async (model) => {
      const exists = await stat(model.path)
        .then((info) => info.isFile())
        .catch(() => false);
      return exists ? model : null;
    }),
  );
  return existing.filter((model): model is ManagedModel => Boolean(model));
}

export async function syncManagedModelDirsFromMetadata({
  shimmyUiHome = defaultShimmyUiHome,
  readConfig,
  writeConfig,
}: HomeAccess & ConfigAccess = {}): Promise<ModelDirSyncResult> {
  const models = await readManagedModels(shimmyUiHome);
  const modelDirs = models.map((model) => path.dirname(model.path));
  return ensureManagedDirRegistered({ readConfig, writeConfig }, shimmyUiHome, modelDirs);
}

export async function deleteManagedModel({
  name,
  shimmyUiHome = defaultShimmyUiHome,
}: {
  name: string;
} & HomeAccess) {
  const model = await readManagedModelByName(name, shimmyUiHome);
  if (!model) {
    throw new Error(`Managed model not found: ${name}`);
  }
  const models = await readManagedModels(shimmyUiHome);
  await removeFileIfPresent(model.path);
  await writeManagedModels(
    models.filter((item) => item.name !== name),
    shimmyUiHome,
  );
  return { ok: true, deleted: name };
}

export async function renameManagedModel({
  name,
  nextName,
  shimmyUiHome = defaultShimmyUiHome,
}: {
  name: string;
  nextName: string;
} & HomeAccess) {
  const model = await readManagedModelByName(name, shimmyUiHome);
  if (!model) {
    throw new Error(`Managed model not found: ${name}`);
  }
  const safeName = safeModelFileName(nextName);
  const targetPath = path.join(path.dirname(model.path), safeName);
  if (targetPath !== model.path) {
    const exists = await stat(targetPath)
      .then((info) => info.isFile())
      .catch(() => false);
    if (exists) {
      throw new Error(`Managed model already exists: ${safeName}`);
    }
    await rename(model.path, targetPath);
  }
  const models = await readManagedModels(shimmyUiHome);
  const updated: ManagedModel = {
    ...model,
    name: safeName,
    path: targetPath,
  };
  await writeManagedModels(
    models.map((item) => (item.name === name ? updated : item)),
    shimmyUiHome,
  );
  return { ok: true, model: updated };
}

export async function importLocalGguf({
  sourcePath,
  shimmyUiHome = defaultShimmyUiHome,
  readConfig = async () => defaultConfig,
  writeConfig,
  probeModel,
}: {
  sourcePath: string;
} & HomeAccess &
  ConfigAccess &
  ProbeAccess) {
  await assertGguf(sourcePath);
  const targetDir = path.join(managedModelsDir(shimmyUiHome), "imported");
  await mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, safeModelFileName(path.basename(sourcePath)));
  await copyFile(sourcePath, targetPath);
  const info = await stat(targetPath);
  try {
    await assertShimmyProbe(path.basename(targetPath), probeModel);
  } catch (error) {
    await removeFileIfPresent(targetPath);
    throw error;
  }
  await ensureManagedDirRegistered({ readConfig, writeConfig }, shimmyUiHome, [targetDir]);
  const model = await recordManagedModel(
    {
      name: path.basename(targetPath),
      path: targetPath,
      sizeBytes: info.size,
      source: "local",
      importedAt: new Date().toISOString(),
    },
    shimmyUiHome,
  );
  return { ok: true, model };
}

export async function downloadCatalogModel({
  model,
  shimmyUiHome = defaultShimmyUiHome,
  readConfig = async () => defaultConfig,
  writeConfig,
  probeModel,
  fetchImpl = fetch,
  onProgress,
}: {
  model: CatalogModel;
  fetchImpl?: typeof fetch;
} & HomeAccess &
  ConfigAccess &
  ProbeAccess &
  ProgressAccess) {
  if (model.compatibility.format !== "gguf" || !model.compatibility.shimmyProbeKnownGood) {
    throw new Error("Catalog model is not marked as Shimmy-compatible GGUF");
  }
  if (!/^[a-f0-9]{64}$/i.test(model.sha256)) {
    throw new Error("Catalog model is missing a sha256 checksum");
  }
  const response = await fetchImpl(model.url, {
    headers: { "user-agent": "shimmy-ui" },
  });
  if (!response.ok) {
    throw new Error(`Model download failed: ${response.status} ${response.statusText}`);
  }
  const tempDir = path.join(managedModelsDir(shimmyUiHome), ".downloads");
  const targetDir = path.join(managedModelsDir(shimmyUiHome), "catalog");
  await mkdir(tempDir, { recursive: true });
  await mkdir(targetDir, { recursive: true });
  const tempPath = path.join(tempDir, `${model.id}.partial`);
  const targetPath = path.join(targetDir, safeModelFileName(model.id));
  let downloadedBytes = 0;

  try {
    const sha256 = createHash("sha256");
    const download = await streamResponseToFile({
      response,
      tempPath,
      hash: sha256,
      onProgress,
    });
    downloadedBytes = download.downloadedBytes;
    const actual = sha256.digest("hex");
    if (model.sha256 && actual !== model.sha256.toLowerCase()) {
      throw new Error(`Model checksum mismatch: expected ${model.sha256}, got ${actual}`);
    }

    onProgress?.({ phase: "validating", downloadedBytes, totalBytes: download.totalBytes });
    await assertGguf(tempPath);
    await rename(tempPath, targetPath);
  } catch (error) {
    await removeFileIfPresent(tempPath);
    throw error;
  }

  const info = await stat(targetPath);
  try {
    onProgress?.({ phase: "probing", downloadedBytes: info.size, totalBytes: info.size });
    await assertShimmyProbe(path.basename(targetPath), probeModel);
  } catch (error) {
    await removeFileIfPresent(targetPath);
    throw error;
  }
  await ensureManagedDirRegistered({ readConfig, writeConfig }, shimmyUiHome, [targetDir]);
  const managedModel = await recordManagedModel(
    {
      name: path.basename(targetPath),
      path: targetPath,
      sizeBytes: info.size,
      source: "catalog",
      catalogId: model.id,
      importedAt: new Date().toISOString(),
    },
    shimmyUiHome,
  );
  onProgress?.({ phase: "done", downloadedBytes: info.size, totalBytes: info.size });
  return { ok: true, model: managedModel };
}

export async function downloadHuggingFaceGguf({
  repoId,
  fileName,
  downloadUrl,
  shimmyUiHome = defaultShimmyUiHome,
  readConfig = async () => defaultConfig,
  writeConfig,
  probeModel,
  fetchImpl = fetch,
  onProgress,
}: {
  repoId: string;
  fileName: string;
  downloadUrl: string;
  fetchImpl?: typeof fetch;
} & HomeAccess &
  ConfigAccess &
  ProbeAccess &
  ProgressAccess) {
  const tempDir = path.join(managedModelsDir(shimmyUiHome), ".downloads");
  const targetDir = path.join(managedModelsDir(shimmyUiHome), "huggingface");
  await mkdir(tempDir, { recursive: true });
  await mkdir(targetDir, { recursive: true });

  const tempName = safeModelFileName(`${repoId.replace(/[\\/]+/g, "--")}-${path.basename(fileName)}`);
  const tempPath = path.join(tempDir, `${tempName}.partial`);
  const targetPath = path.join(
    targetDir,
    safeModelFileName(`${repoId.replace(/[\\/]+/g, "--")}-${path.basename(fileName)}`),
  );
  let downloadedBytes = 0;
  let totalBytes: number | undefined;

  const requestDownload = (offset?: number) =>
    fetchImpl(downloadUrl, {
      headers: {
        "user-agent": "shimmy-ui",
        ...(offset && offset > 0 ? { range: `bytes=${offset}-` } : {}),
      },
    });

  let resumeFromBytes = await fileSizeIfPresent(tempPath);
  let response = await requestDownload(resumeFromBytes > 0 ? resumeFromBytes : undefined);
  let append = false;
  let initialDownloadedBytes = 0;
  let skipTransfer = false;

  if (resumeFromBytes > 0) {
    if (response.status === 206) {
      append = true;
      initialDownloadedBytes = resumeFromBytes;
      totalBytes =
        parseContentRangeTotal(response.headers.get("content-range")) ??
        (parseContentLength(response.headers.get("content-length")) ?? 0) + resumeFromBytes;
    } else if (response.status === 200) {
      append = false;
      initialDownloadedBytes = 0;
      totalBytes = parseContentLength(response.headers.get("content-length"));
    } else if (response.status === 416) {
      const remoteTotal = parseContentRangeTotal(response.headers.get("content-range"));
      if (remoteTotal && remoteTotal === resumeFromBytes) {
        skipTransfer = true;
        downloadedBytes = resumeFromBytes;
        totalBytes = remoteTotal;
        onProgress?.({ phase: "downloading", downloadedBytes, totalBytes });
      } else {
        await removeFileIfPresent(tempPath);
        resumeFromBytes = 0;
        response = await requestDownload();
      }
    }
  }

  if (!skipTransfer && !response.ok) {
    throw new Error(`Model download failed: ${response.status} ${response.statusText}`);
  }

  let stage: "transfer" | "validation" | "finalize" = skipTransfer ? "validation" : "transfer";
  try {
    if (!skipTransfer) {
      const download = await streamResponseToFile({
        response,
        tempPath,
        onProgress,
        append,
        initialDownloadedBytes,
        totalBytes,
      });
      downloadedBytes = download.downloadedBytes;
      totalBytes = download.totalBytes;
      stage = "validation";
    }
    onProgress?.({ phase: "validating", downloadedBytes, totalBytes });
    await assertGguf(tempPath);
    stage = "finalize";
    await rename(tempPath, targetPath);
  } catch (error) {
    if (stage !== "transfer") {
      await removeFileIfPresent(tempPath);
    }
    throw error;
  }

  const info = await stat(targetPath);
  try {
    onProgress?.({ phase: "probing", downloadedBytes: info.size, totalBytes: totalBytes ?? info.size });
    await assertShimmyProbe(path.basename(targetPath), probeModel);
  } catch (error) {
    await removeFileIfPresent(targetPath);
    throw error;
  }

  await ensureManagedDirRegistered({ readConfig, writeConfig }, shimmyUiHome, [targetDir]);
  const model = await recordManagedModel(
    {
      name: path.basename(targetPath),
      path: targetPath,
      sizeBytes: info.size,
      source: "huggingface",
      catalogId: `hf:${repoId}:${fileName}`,
      huggingFaceRepoId: repoId,
      huggingFaceFile: fileName,
      importedAt: new Date().toISOString(),
    },
    shimmyUiHome,
  );
  onProgress?.({ phase: "done", downloadedBytes: info.size, totalBytes: totalBytes ?? info.size });
  return { ok: true, model };
}

export async function scanManagedModelFiles(shimmyUiHome = defaultShimmyUiHome) {
  const root = managedModelsDir(shimmyUiHome);
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".gguf"))
    .map((entry) => path.join((entry as typeof entry & { parentPath?: string }).parentPath ?? root, entry.name));
}
