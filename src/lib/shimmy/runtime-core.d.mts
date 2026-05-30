export class RuntimeOperationBusyError extends Error {
  constructor(activeOperation: string);
}

export function withRuntimeOperationLock<T>(
  operation: string,
  callback: () => Promise<T>,
): Promise<T>;

export function defaultShimmyUiHome(): string;

export function platformAssetNames(osName?: string, cpu?: string): string[];

export interface GithubReleaseAssetInput {
  id?: number;
  name: string;
  size?: number;
  digest?: string | null;
  browser_download_url: string;
}

export interface GithubReleaseInput {
  tag_name: string;
  name?: string;
  html_url?: string;
  published_at?: string;
  prerelease?: boolean;
  assets?: GithubReleaseAssetInput[];
}

export interface RuntimeAsset {
  id?: number;
  name: string;
  size?: number;
  digest: string | null;
  downloadUrl: string;
}

export interface RuntimeRelease {
  tagName: string;
  name?: string;
  htmlUrl?: string;
  publishedAt?: string;
  prerelease: boolean;
  asset: RuntimeAsset;
  assets: RuntimeAsset[];
}

export function selectReleaseAsset(
  release: GithubReleaseInput,
  osName?: string,
  cpu?: string,
): RuntimeAsset | null;

export function latestShimmyRelease(options?: { refresh?: boolean }): Promise<RuntimeRelease>;

export function verifySha256(
  buffer: Buffer,
  digest?: string | null,
  label?: string,
): string;

export function readVerifiedRuntimeFile(
  filePath: string,
  digest?: string | null,
  missingMessage?: string,
): Promise<Buffer>;

export interface RuntimeCoreConfig {
  shimmyPath?: string;
}

export interface RuntimeCoreOptions {
  readConfig: () => Promise<RuntimeCoreConfig>;
  writeConfig: (input: RuntimeCoreConfig) => Promise<RuntimeCoreConfig>;
  shimmyUiHome?: () => string;
  runtimeMetaPath?: () => string;
}

export interface RuntimeCore {
  managedBinaryPath: () => string;
  runtimeStatus: () => Promise<Record<string, unknown>>;
  downloadRuntime: () => Promise<Record<string, unknown>>;
  installRuntime: (options?: { useExistingDownload?: boolean }) => Promise<Record<string, unknown>>;
  updateRuntime: () => Promise<Record<string, unknown>>;
  uninstallRuntime: () => Promise<Record<string, unknown>>;
  rollbackRuntime: (backupPath?: string) => Promise<Record<string, unknown>>;
}

export function createRuntimeManager(options: RuntimeCoreOptions): RuntimeCore;
