import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

async function ensureManagedDirRegistered(
  { readConfig, writeConfig }: ConfigAccess,
  shimmyUiHome = defaultShimmyUiHome,
) {
  if (!readConfig || !writeConfig) return;
  const managedDir = managedModelsDir(shimmyUiHome);
  const config = await readConfig();
  if (config.modelDirs.includes(managedDir)) return;
  await writeConfig({
    ...config,
    modelDirs: [managedDir, ...config.modelDirs],
  });
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
  const result = await probeModel(modelName);
  if (!result.ok) {
    const output = result.output ? `: ${result.output}` : "";
    throw new Error(`Shimmy probe failed for ${modelName}${output}`);
  }
}

async function removeFileIfPresent(filePath: string) {
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
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
  await ensureManagedDirRegistered({ readConfig, writeConfig }, shimmyUiHome);
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
}: {
  model: CatalogModel;
  fetchImpl?: typeof fetch;
} & HomeAccess &
  ConfigAccess &
  ProbeAccess) {
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
  const buffer = Buffer.from(await response.arrayBuffer());
  const actual = createHash("sha256").update(buffer).digest("hex");
  if (model.sha256 && actual !== model.sha256.toLowerCase()) {
    throw new Error(`Model checksum mismatch: expected ${model.sha256}, got ${actual}`);
  }
  const tempDir = path.join(managedModelsDir(shimmyUiHome), ".downloads");
  const targetDir = path.join(managedModelsDir(shimmyUiHome), "catalog");
  await mkdir(tempDir, { recursive: true });
  await mkdir(targetDir, { recursive: true });
  const tempPath = path.join(tempDir, `${model.id}.partial`);
  const targetPath = path.join(targetDir, safeModelFileName(model.id));
  await writeFile(tempPath, buffer);
  await assertGguf(tempPath);
  await rename(tempPath, targetPath);
  const info = await stat(targetPath);
  try {
    await assertShimmyProbe(path.basename(targetPath), probeModel);
  } catch (error) {
    await removeFileIfPresent(targetPath);
    throw error;
  }
  await ensureManagedDirRegistered({ readConfig, writeConfig }, shimmyUiHome);
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
  return { ok: true, model: managedModel };
}

export async function scanManagedModelFiles(shimmyUiHome = defaultShimmyUiHome) {
  const root = managedModelsDir(shimmyUiHome);
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".gguf"))
    .map((entry) => path.join((entry as typeof entry & { parentPath?: string }).parentPath ?? root, entry.name));
}
