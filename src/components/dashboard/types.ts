export type DashboardTab =
  | "overview"
  | "models"
  | "chat"
  | "runtime"
  | "config"
  | "logs"
  | "diagnostics";

export interface GenerationSettings {
  temperature: number;
  topP: number;
  maxTokens: number;
}

export type ChatPresetId = "precise" | "balanced" | "creative";

export interface ChatHistoryItem {
  id: string;
  model: string;
  prompt: string;
  response: string;
  createdAt: string;
}

export interface DiscoverSummary {
  modelsFound: number;
  elapsedMs: number;
  error?: string;
}

export type ModelDownloadPhase = "downloading" | "validating" | "probing" | "done";

export interface ModelDownloadJob {
  jobId: string;
  phase: ModelDownloadPhase;
  downloadedBytes: number;
  totalBytes?: number;
  startedAt: string;
  updatedAt: string;
  done: boolean;
  error?: string;
}

export type LogStreamFilter = "all" | "stdout" | "stderr" | "system";

export type {
  CatalogModel,
  HuggingFaceModel,
  HuggingFaceModelFile,
  HuggingFaceSearchSort,
  ManagedModel,
  OllamaModel,
  OllamaStatus,
  OllamaCatalogModel,
} from "@/lib/model-library/types";
