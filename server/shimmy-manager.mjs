import { execFile, spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";
import {
  RuntimeOperationBusyError,
  createRuntimeManager,
  latestShimmyRelease,
  platformAssetNames,
  readVerifiedRuntimeFile,
  selectReleaseAsset,
  verifySha256,
  withRuntimeOperationLock,
} from "../src/lib/shimmy/runtime-core.mjs";

export {
  RuntimeOperationBusyError,
  latestShimmyRelease,
  platformAssetNames,
  readVerifiedRuntimeFile,
  selectReleaseAsset,
  verifySha256,
  withRuntimeOperationLock,
};

export const defaultConfig = {
  bindAddress: "127.0.0.1:11435",
  modelDirs: [],
  gpuBackend: "auto",
  language: "zh",
  theme: "dark",
};

export class LogBuffer {
  constructor(maxEntries = 700) {
    this.maxEntries = maxEntries;
    this.entries = [];
    this.nextId = 1;
  }

  push(stream, message) {
    const entry = {
      id: this.nextId++,
      time: new Date().toISOString(),
      stream,
      message,
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    return entry;
  }

  list() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
  }
}

export function configPath() {
  return process.env.SHIMMY_UI_CONFIG_PATH
    ? process.env.SHIMMY_UI_CONFIG_PATH
    : path.join(homedir(), ".shimmy-ui", "config.json");
}

export function shimmyUiHome() {
  return process.env.SHIMMY_UI_HOME || path.join(homedir(), ".shimmy-ui");
}

export function managedBinaryPath() {
  return path.join(shimmyUiHome(), "bin", platform() === "win32" ? "shimmy.exe" : "shimmy");
}

function runtimeMetaPath() {
  return process.env.SHIMMY_UI_RUNTIME_PATH || path.join(shimmyUiHome(), "runtime.json");
}

const maxModelDirScanDepth = 3;
const maxModelDirScanEntries = 2000;
const maxModelDirSamples = 5;

export function normalizeConfig(input = {}) {
  const config = { ...defaultConfig, ...input };
  config.modelDirs = Array.isArray(config.modelDirs)
    ? config.modelDirs.filter(Boolean)
    : [];
  if (!/^[\w.:-]+:\d{1,5}$/.test(config.bindAddress)) {
    throw new Error("bindAddress must look like 127.0.0.1:11435");
  }
  if (config.maxCtx !== undefined) {
    const maxCtx = Number(config.maxCtx);
    if (!Number.isInteger(maxCtx) || maxCtx < 512 || maxCtx > 131072) {
      throw new Error("maxCtx must be between 512 and 131072");
    }
    config.maxCtx = maxCtx;
  }
  if (!["auto", "cpu", "cuda", "vulkan", "opencl"].includes(config.gpuBackend)) {
    config.gpuBackend = "auto";
  }
  if (!["en", "zh"].includes(config.language)) {
    config.language = "zh";
  }
  if (!["dark", "light", "system"].includes(config.theme)) {
    config.theme = "dark";
  }
  return config;
}

export async function readConfig() {
  try {
    return normalizeConfig(JSON.parse(await readFile(configPath(), "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return defaultConfig;
    throw error;
  }
}

export async function writeConfig(input) {
  const config = normalizeConfig(input);
  await mkdir(path.dirname(configPath()), { recursive: true });
  await writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

async function executable(filePath) {
  try {
    const mode = platform() === "win32" ? constants.F_OK : constants.X_OK;
    await access(filePath, mode);
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function execFileText(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 5000, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.output = `${stdout}${stderr}`.trim();
        reject(error);
        return;
      }
      resolve(`${stdout}${stderr}`.trim());
    });
  });
}

async function candidate(filePath, source) {
  const exists = await stat(filePath)
    .then((info) => info.isFile())
    .catch(() => false);
  const isExec = exists ? await executable(filePath) : false;
  const result = { path: filePath, exists, executable: isExec, source };
  if (isExec) {
    try {
      result.version = await execFileText(filePath, ["--version"], { timeout: 2000 });
    } catch {
      result.version = undefined;
    }
  }
  return result;
}

function pathCandidates() {
  return [...new Set((process.env.PATH || "").split(path.delimiter).filter(Boolean))]
    .flatMap((dir) =>
      platform() === "win32"
        ? [path.join(dir, "shimmy.exe"), path.join(dir, "shimmy")]
        : [path.join(dir, "shimmy")],
    );
}

export async function detectShimmyBinary(config, cwd = process.cwd()) {
  const configured = config.shimmyPath
    ? [await candidate(config.shimmyPath, "configured")]
    : [];
  const managed = [await candidate(managedBinaryPath(), "managed")];
  const fromPath = await Promise.all(pathCandidates().map((item) => candidate(item, "path")));
  const fromProject = await Promise.all(
    ["shimmy", "shimmy.exe"].map((item) => candidate(path.join(cwd, item), "project")),
  );
  const fromHome = await Promise.all(
    ["shimmy", "shimmy.exe"].map((item) => candidate(path.join(homedir(), "bin", item), "home")),
  );
  const candidates = [...configured, ...managed, ...fromPath, ...fromProject, ...fromHome];
  return { selected: candidates.find((item) => item.executable) || null, candidates };
}

export async function inspectModelDirectories(modelDirs) {
  const directories = await Promise.all(modelDirs.map(inspectModelDirectory));
  const totalGgufFiles = directories.reduce((sum, item) => sum + item.ggufFiles, 0);
  return {
    configured: modelDirs.length > 0,
    directories,
    totalGgufFiles,
    hasReadableDirectory: directories.some((item) => item.readable),
    hasModels: totalGgufFiles > 0,
  };
}

async function inspectModelDirectory(dirPath) {
  try {
    const info = await stat(dirPath);
    if (!info.isDirectory()) {
      return {
        path: dirPath,
        exists: true,
        readable: false,
        ggufFiles: 0,
        sampleFiles: [],
        error: "Path is not a directory",
      };
    }
    await access(dirPath);
    const scan = await scanForGguf(dirPath);
    return {
      path: dirPath,
      exists: true,
      readable: true,
      ggufFiles: scan.count,
      sampleFiles: scan.samples,
      error: scan.truncated ? "Scan stopped after reaching the safety limit" : undefined,
    };
  } catch (error) {
    return {
      path: dirPath,
      exists: error.code !== "ENOENT",
      readable: false,
      ggufFiles: 0,
      sampleFiles: [],
      error: error.message || "Unable to read directory",
    };
  }
}

async function scanForGguf(root) {
  let visited = 0;
  let count = 0;
  let truncated = false;
  const samples = [];

  async function visit(currentPath, depth) {
    if (visited >= maxModelDirScanEntries) {
      truncated = true;
      return;
    }
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (visited >= maxModelDirScanEntries) {
        truncated = true;
        return;
      }
      visited += 1;
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory() && depth < maxModelDirScanDepth) {
        await visit(entryPath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".gguf")) {
        count += 1;
        if (samples.length < maxModelDirSamples) samples.push(entryPath);
      }
    }
  }

  await visit(root, 0);
  return { count, samples, truncated };
}

const sharedRuntimeManager = createRuntimeManager({
  readConfig,
  writeConfig,
  shimmyUiHome,
  runtimeMetaPath,
});

export const runtimeStatus = sharedRuntimeManager.runtimeStatus;
export const downloadRuntime = sharedRuntimeManager.downloadRuntime;
export const installRuntime = sharedRuntimeManager.installRuntime;
export const updateRuntime = sharedRuntimeManager.updateRuntime;
export const uninstallRuntime = sharedRuntimeManager.uninstallRuntime;
export const rollbackRuntime = sharedRuntimeManager.rollbackRuntime;

export function serveCommand(binaryPath, config) {
  const args = ["serve", "--bind", config.bindAddress];
  if (config.gpuBackend !== "auto") args.push("--gpu-backend", config.gpuBackend);
  const env = {};
  if (config.modelDirs.length) env.SHIMMY_MODEL_PATHS = config.modelDirs.join(";");
  if (config.baseGguf) env.SHIMMY_BASE_GGUF = config.baseGguf;
  if (config.maxCtx) env.SHIMMY_MAX_CTX = String(config.maxCtx);
  return { command: binaryPath, args, env };
}

export async function fetchJson(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export class ShimmyManager {
  constructor() {
    this.child = null;
    this.state = "stopped";
    this.lastError = null;
    this.logs = new LogBuffer();
  }

  get pid() {
    return this.child?.pid;
  }

  stateFor(binary, healthOk) {
    if (!binary) return "missing-binary";
    if (this.child && this.state !== "error") {
      return this.state === "starting" ? "starting" : "running-managed";
    }
    if (healthOk) return "running-external";
    if (this.lastError) return "error";
    return "stopped";
  }

  async health(bindAddress) {
    const endpoint = `http://${bindAddress}/health`;
    try {
      const data = await fetchJson(endpoint);
      return {
        ok: data.status === "ok",
        status: data.status,
        service: data.service,
        version: data.version,
        modelsTotal: data.models?.total,
        discovered: data.models?.discovered,
        manual: data.models?.manual,
        endpoint,
      };
    } catch (error) {
      return { ok: false, endpoint, error: error.message };
    }
  }

  async metrics(bindAddress) {
    try {
      const data = await fetchJson(`http://${bindAddress}/metrics`);
      return {
        ok: true,
        gpuDetected: Boolean(data.gpu_detected),
        gpuVendor: data.gpu_vendor ?? null,
        memoryTotalMb: data.system?.memory_total_mb,
        memoryFreeMb: data.system?.memory_free_mb,
        memoryAvailableMb: data.system?.memory_available_mb,
        totalModelSizeMb: data.models?.total_size_mb,
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async status() {
    const config = await readConfig();
    const detection = await detectShimmyBinary(config);
    const health = await this.health(config.bindAddress);
    const metrics = await this.metrics(config.bindAddress);
    const modelDirsHealth = await inspectModelDirectories(config.modelDirs);
    return {
      state: this.stateFor(detection.selected, health.ok),
      config,
      binary: detection.selected,
      managedPid: this.pid,
      health,
      metrics,
      modelDirsHealth,
      logsCount: this.logs.list().length,
    };
  }

  async start() {
    const config = await readConfig();
    const detection = await detectShimmyBinary(config);
    if (!detection.selected) throw new Error("Shimmy binary was not found or is not executable");
    if (this.child) return { state: "running-managed", pid: this.child.pid };
    const health = await this.health(config.bindAddress);
    if (health.ok) {
      this.logs.push("system", `External shimmy service detected at ${health.endpoint}`);
      return { state: "running-external", external: true };
    }
    const command = serveCommand(detection.selected.path, config);
    this.logs.push("system", `Starting ${command.command} ${command.args.join(" ")}`);
    this.state = "starting";
    const child = spawn(command.command, command.args, {
      env: { ...process.env, ...command.env },
      shell: false,
      stdio: "pipe",
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      this.state = "running-managed";
      String(chunk)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.logs.push("stdout", line));
    });
    child.stderr.on("data", (chunk) => {
      String(chunk)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.logs.push("stderr", line));
    });
    child.on("spawn", () => {
      this.state = "running-managed";
      this.logs.push("system", `Shimmy process spawned with pid ${child.pid || "unknown"}`);
    });
    child.on("error", (error) => {
      this.lastError = error.message;
      this.state = "error";
      this.child = null;
      this.logs.push("stderr", error.message);
    });
    child.on("exit", (code, signal) => {
      this.child = null;
      this.state = this.lastError ? "error" : "stopped";
      this.logs.push("system", `Shimmy exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
    });
    return { state: this.state, pid: child.pid };
  }

  async stop() {
    if (!this.child) {
      this.logs.push("system", "No managed shimmy process to stop");
      return { stopped: false };
    }
    const child = this.child;
    this.child = null;
    this.state = "stopped";
    this.logs.push("system", `Stopping managed shimmy process ${child.pid || "unknown"}`);
    child.kill("SIGTERM");
    return { stopped: true };
  }

  async models() {
    const config = await readConfig();
    const data = await fetchJson(`http://${config.bindAddress}/api/models`);
    return (data.models || []).map((model) => ({
      name: String(model.name || model.id || model.model || "unknown"),
      source: String(model.source || "shimmy"),
      sizeBytes: model.size_bytes,
      modelType: model.model_type,
      parameterCount: model.parameter_count,
      quantization: model.quantization,
      loraPath: model.lora_path,
    }));
  }

  async discover() {
    const config = await readConfig();
    const data = await fetchJson(`http://${config.bindAddress}/api/models/discover`, {
      method: "POST",
    });
    return data.models || [];
  }

  async probe(model) {
    const config = await readConfig();
    const detection = await detectShimmyBinary(config);
    if (!detection.selected) throw new Error("Shimmy binary not found");
    const env = {
      ...process.env,
      ...(config.modelDirs.length ? { SHIMMY_MODEL_PATHS: config.modelDirs.join(";") } : {}),
      ...(config.baseGguf ? { SHIMMY_BASE_GGUF: config.baseGguf } : {}),
      ...(config.maxCtx ? { SHIMMY_MAX_CTX: String(config.maxCtx) } : {}),
    };
    try {
      const output = await execFileText(detection.selected.path, ["probe", model], { env });
      return { ok: true, output };
    } catch (error) {
      return { ok: false, output: error.output || error.message };
    }
  }

  async gpuInfo() {
    const config = await readConfig();
    const detection = await detectShimmyBinary(config);
    if (!detection.selected) throw new Error("Shimmy binary not found");
    return { output: await execFileText(detection.selected.path, ["gpu-info"]) };
  }
}
