import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { OllamaCatalogModel, OllamaModel, OllamaStatus } from "./types";

const fallbackBaseUrl = "http://127.0.0.1:11434";
const execFileAsync = promisify(execFile);
type ExecFileRunner = (
  file: string,
  args?: readonly string[] | null,
  options?: { timeout?: number },
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

type OllamaOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  execFileImpl?: ExecFileRunner;
};

function defaultBaseUrl() {
  return process.env.SHIMMY_UI_OLLAMA_BASE_URL?.trim() || fallbackBaseUrl;
}

export const ollamaCatalogModels: OllamaCatalogModel[] = [
  {
    name: "qwen2.5:1.5b",
    family: "qwen",
    sizeLabel: "1.5B",
    description: "Small multilingual chat model that downloads quickly.",
    tags: ["chat", "small", "multilingual", "recommended"],
  },
  {
    name: "llama3.2:1b",
    family: "llama",
    sizeLabel: "1B",
    description: "Very small Llama model for quick local checks.",
    tags: ["chat", "small", "fast"],
  },
  {
    name: "llama3.2:3b",
    family: "llama",
    sizeLabel: "3B",
    description: "General local chat model with a stronger quality baseline.",
    tags: ["chat", "general"],
  },
  {
    name: "gemma2:2b",
    family: "gemma",
    sizeLabel: "2B",
    description: "Compact Gemma model for instruction-following tests.",
    tags: ["chat", "small", "instruction"],
  },
];

function jsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function readOllamaStatus({
  baseUrl = defaultBaseUrl(),
  fetchImpl = fetch,
  execFileImpl = execFileAsync,
}: OllamaOptions = {}): Promise<OllamaStatus> {
  try {
    const data = await jsonResponse<{ version?: string }>(
      await fetchImpl(`${baseUrl}/api/version`, { cache: "no-store" }),
    );
    return {
      installed: true,
      running: true,
      version: data.version,
      baseUrl,
    };
  } catch (error) {
    const cli = await readOllamaCliVersion(execFileImpl);
    return {
      installed: cli.installed,
      running: false,
      version: cli.version,
      baseUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readOllamaCliVersion(execFileImpl: ExecFileRunner) {
  try {
    const { stdout, stderr } = await execFileImpl("ollama", ["--version"], {
      timeout: 2_000,
    });
    const output = `${stdout} ${stderr}`.trim();
    return {
      installed: true,
      version: output.match(/\d+(?:\.\d+){1,3}/)?.[0],
    };
  } catch {
    return { installed: false, version: undefined };
  }
}

export async function startOllama({
  execFileImpl = execFileAsync,
  spawnImpl = spawn,
}: Pick<OllamaOptions, "execFileImpl"> & {
  spawnImpl?: typeof spawn;
} = {}) {
  try {
    await readOllamaCliVersion(execFileImpl);
    const child = spawnImpl("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { ok: true, started: true, pid: child.pid };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("address already in use")) {
      return { ok: true, started: false, alreadyRunning: true };
    }
    throw error;
  }
}

function isImportableOllamaDetails(details?: { format?: string }, capabilities?: string[]) {
  if (details?.format?.toLowerCase() !== "gguf") return false;
  if (capabilities?.length && !capabilities.includes("completion")) return false;
  return true;
}

export async function listOllamaModels({
  baseUrl = defaultBaseUrl(),
  fetchImpl = fetch,
}: OllamaOptions = {}): Promise<OllamaModel[]> {
  const tags = await jsonResponse<{
    models?: Array<{ name?: string; size?: number; details?: { family?: string } }>;
  }>(await fetchImpl(`${baseUrl}/api/tags`, { cache: "no-store" }));

  const models = await Promise.all(
    (tags.models ?? []).map(async (model) => {
      const name = String(model.name ?? "");
      try {
        const details = await jsonResponse<{
          details?: { format?: string; family?: string; quantization_level?: string };
          capabilities?: string[];
        }>(
          await fetchImpl(`${baseUrl}/api/show`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: name }),
          }),
        );
        const importable = isImportableOllamaDetails(details.details, details.capabilities);
        return {
          name,
          sizeBytes: model.size,
          family: details.details?.family ?? model.details?.family,
          format: details.details?.format,
          quantization: details.details?.quantization_level,
          importable,
          reason: importable ? undefined : "Ollama model is not exposed as a GGUF completion model",
        };
      } catch (error) {
        return {
          name,
          sizeBytes: model.size,
          family: model.details?.family,
          importable: false,
          reason: error instanceof Error ? error.message : "Unable to inspect Ollama model",
        };
      }
    }),
  );

  return models.filter((model) => model.name);
}

export function searchOllamaCatalog(query = "", models = ollamaCatalogModels) {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return models.filter((model) =>
    terms.every((term) =>
      [
        model.name,
        model.family,
        model.sizeLabel,
        model.description,
        ...model.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    ),
  );
}

export async function pullOllamaModel({
  model,
  baseUrl = defaultBaseUrl(),
  fetchImpl = fetch,
}: {
  model: string;
} & OllamaOptions) {
  await jsonResponse(
    await fetchImpl(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: false }),
    }),
  );

  let details:
    | {
        details?: { format?: string };
        capabilities?: string[];
      }
    | undefined;
  try {
    details = await jsonResponse<{
      details?: { format?: string };
      capabilities?: string[];
    }>(
      await fetchImpl(`${baseUrl}/api/show`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model }),
      }),
    );
  } catch {
    await fetchImpl(`${baseUrl}/api/delete`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
    }).catch(() => undefined);
    throw new Error("Pulled Ollama model could not be verified for Shimmy compatibility");
  }

  if (!isImportableOllamaDetails(details.details, details.capabilities)) {
    await fetchImpl(`${baseUrl}/api/delete`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
    }).catch(() => undefined);
    throw new Error("Pulled Ollama model is not a GGUF completion model compatible with Shimmy");
  }

  return { ok: true, model };
}

export async function deleteOllamaModel({
  model,
  baseUrl = defaultBaseUrl(),
  fetchImpl = fetch,
}: {
  model: string;
} & OllamaOptions) {
  const response = await fetchImpl(`${baseUrl}/api/delete`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!response.ok) {
    throw new Error(`Ollama delete failed: ${response.status} ${response.statusText}`);
  }
  return { ok: true, deleted: model };
}
