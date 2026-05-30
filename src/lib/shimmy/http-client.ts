import type { HealthSummary, MetricsSummary, ShimmyModel } from "./types";

function baseUrl(bindAddress: string) {
  return `http://${bindAddress}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function readHealth(bindAddress: string): Promise<HealthSummary> {
  const endpoint = `${baseUrl(bindAddress)}/health`;
  try {
    const data = await fetchJson<Record<string, unknown>>(endpoint);
    const models = data.models as
      | { total?: number; discovered?: number; manual?: number }
      | undefined;
    return {
      ok: data.status === "ok",
      status: String(data.status ?? "unknown"),
      service: data.service ? String(data.service) : undefined,
      version: data.version ? String(data.version) : undefined,
      modelsTotal: models?.total,
      discovered: models?.discovered,
      manual: models?.manual,
      endpoint,
    };
  } catch (error) {
    return {
      ok: false,
      endpoint,
      error: error instanceof Error ? error.message : "Health request failed",
    };
  }
}

export async function readMetrics(bindAddress: string): Promise<MetricsSummary> {
  try {
    const data = await fetchJson<Record<string, unknown>>(`${baseUrl(bindAddress)}/metrics`);
    const system = data.system as
      | {
          memory_total_mb?: number;
          memory_free_mb?: number;
          memory_available_mb?: number;
        }
      | undefined;
    const models = data.models as { total_size_mb?: number } | undefined;
    return {
      ok: true,
      gpuDetected: Boolean(data.gpu_detected),
      gpuVendor:
        typeof data.gpu_vendor === "string" ? data.gpu_vendor : data.gpu_vendor === null ? null : undefined,
      memoryTotalMb: system?.memory_total_mb,
      memoryFreeMb: system?.memory_free_mb,
      memoryAvailableMb: system?.memory_available_mb,
      totalModelSizeMb: models?.total_size_mb,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Metrics request failed",
    };
  }
}

function normalizeModel(raw: Record<string, unknown>): ShimmyModel {
  return {
    name: String(raw.name ?? raw.id ?? raw.model ?? "unknown"),
    source: String(raw.source ?? "shimmy"),
    sizeBytes: typeof raw.size_bytes === "number" ? raw.size_bytes : undefined,
    modelType: typeof raw.model_type === "string" ? raw.model_type : undefined,
    parameterCount:
      typeof raw.parameter_count === "string" ? raw.parameter_count : undefined,
    quantization: typeof raw.quantization === "string" ? raw.quantization : undefined,
    loraPath: typeof raw.lora_path === "string" ? raw.lora_path : undefined,
  };
}

export async function readModels(bindAddress: string): Promise<ShimmyModel[]> {
  const data = await fetchJson<{ models?: Record<string, unknown>[] }>(
    `${baseUrl(bindAddress)}/api/models`,
  );
  return (data.models ?? []).map(normalizeModel);
}

export async function discoverModels(bindAddress: string): Promise<ShimmyModel[]> {
  const data = await fetchJson<{ models?: Record<string, unknown>[] }>(
    `${baseUrl(bindAddress)}/api/models/discover`,
    { method: "POST" },
  );
  return (data.models ?? []).map(normalizeModel);
}

export function shimmyBaseUrl(bindAddress: string) {
  return baseUrl(bindAddress);
}
