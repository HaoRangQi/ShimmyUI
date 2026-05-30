export interface CatalogModel {
  id: string;
  name: string;
  family: string;
  architecture: string;
  quantization: string;
  sizeBytes: number;
  url: string;
  sha256: string;
  license: string;
  minRamGb?: number;
  tags?: string[];
  description?: string;
  compatibility: {
    format: "gguf" | "other";
    shimmyProbeKnownGood: boolean;
    testedShimmyVersion?: string;
  };
}

export interface ManagedModel {
  name: string;
  path: string;
  sizeBytes: number;
  source: "catalog" | "local" | "ollama" | "huggingface";
  catalogId?: string;
  huggingFaceRepoId?: string;
  huggingFaceFile?: string;
  importedAt: string;
}

export type HuggingFaceSearchSort = "trending" | "downloads" | "updated";

export interface HuggingFaceModel {
  repoId: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  ggufFileCount?: number;
  tags: string[];
}

export interface HuggingFaceModelFile {
  name: string;
  sizeBytes?: number;
  quantization?: string;
  downloadUrl: string;
}

export interface GgufMetadata {
  path: string;
  valid: boolean;
  version?: number;
  sizeBytes: number;
}

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  baseUrl: string;
  error?: string;
}

export interface OllamaModel {
  name: string;
  sizeBytes?: number;
  family?: string;
  format?: string;
  quantization?: string;
  importable: boolean;
  reason?: string;
}

export interface OllamaCatalogModel {
  name: string;
  family: string;
  sizeLabel: string;
  description: string;
  tags: string[];
}
