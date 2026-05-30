export type ServiceState =
  | "missing-binary"
  | "stopped"
  | "starting"
  | "running-managed"
  | "running-external"
  | "error";

export type ShimmyLanguage = "en" | "zh";
export type ShimmyTheme = "dark" | "light" | "system";
export type ShimmyGpuBackend = "auto" | "cpu" | "cuda" | "vulkan" | "opencl";

export interface ShimmyUiConfig {
  shimmyPath?: string;
  bindAddress: string;
  modelDirs: string[];
  baseGguf?: string;
  maxCtx?: number;
  gpuBackend: ShimmyGpuBackend;
  language: ShimmyLanguage;
  theme: ShimmyTheme;
  defaultModel?: string;
}

export interface BinaryCandidate {
  path: string;
  exists: boolean;
  executable: boolean;
  source: "configured" | "managed" | "path" | "project" | "home";
  version?: string;
}

export interface ShimmyModel {
  name: string;
  source: string;
  sizeBytes?: number;
  modelType?: string;
  parameterCount?: string;
  quantization?: string;
  loraPath?: string;
}

export interface HealthSummary {
  ok: boolean;
  status?: string;
  service?: string;
  version?: string;
  modelsTotal?: number;
  discovered?: number;
  manual?: number;
  endpoint?: string;
  error?: string;
}

export interface MetricsSummary {
  ok: boolean;
  gpuDetected?: boolean;
  gpuVendor?: string | null;
  memoryTotalMb?: number;
  memoryFreeMb?: number;
  memoryAvailableMb?: number;
  totalModelSizeMb?: number;
  error?: string;
}

export interface LogEntry {
  id: number;
  time: string;
  stream: "stdout" | "stderr" | "system";
  message: string;
}

export interface ModelDirectoryStatus {
  path: string;
  exists: boolean;
  readable: boolean;
  ggufFiles: number;
  sampleFiles: string[];
  error?: string;
}

export interface ModelDirectoriesHealth {
  configured: boolean;
  directories: ModelDirectoryStatus[];
  totalGgufFiles: number;
  hasReadableDirectory: boolean;
  hasModels: boolean;
}

export interface AppStatus {
  state: ServiceState;
  config: ShimmyUiConfig;
  binary: BinaryCandidate | null;
  managedPid?: number;
  health: HealthSummary;
  metrics: MetricsSummary;
  modelDirsHealth: ModelDirectoriesHealth;
  logsCount: number;
}
