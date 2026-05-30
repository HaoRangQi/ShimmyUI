import type {
  HuggingFaceModel,
  HuggingFaceModelFile,
  HuggingFaceSearchSort,
} from "./types";

const huggingFaceBaseUrl = "https://huggingface.co";

type HuggingFaceOptions = {
  fetchImpl?: typeof fetch;
};

type HuggingFaceSearchOptions = HuggingFaceOptions & {
  query?: string;
  limit?: number;
  sort?: HuggingFaceSearchSort;
};

type HuggingFaceApiModel = {
  id?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  tags?: string[];
};

function toSortField(sort: HuggingFaceSearchSort) {
  if (sort === "updated") return "lastModified";
  if (sort === "downloads") return "downloads";
  return "trendingScore";
}

function safeLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return 20;
  return Math.min(Math.max(Math.trunc(value ?? 20), 1), 50);
}

function ggufFileCount(tags: string[]) {
  const text = tags.join(" ").toLowerCase();
  const explicit = text.match(/gguf-files?:(\d{1,4})/);
  if (!explicit) return undefined;
  const parsed = Number.parseInt(explicit[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function jsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Hugging Face request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function encodeRepoId(repoId: string) {
  return repoId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function encodeRepoFilePath(filePath: string) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function huggingFaceDownloadUrl(repoId: string, filePath: string) {
  return `${huggingFaceBaseUrl}/${encodeRepoId(repoId)}/resolve/main/${encodeRepoFilePath(filePath)}?download=true`;
}

export async function searchHuggingFaceModels({
  query = "",
  limit = 20,
  sort = "downloads",
  fetchImpl = fetch,
}: HuggingFaceSearchOptions = {}): Promise<HuggingFaceModel[]> {
  const params = new URLSearchParams({
    filter: "gguf",
    sort: toSortField(sort),
    direction: "-1",
    limit: String(safeLimit(limit)),
  });
  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    params.set("search", trimmedQuery);
  }

  const models = await jsonResponse<HuggingFaceApiModel[]>(
    await fetchImpl(`${huggingFaceBaseUrl}/api/models?${params.toString()}`, {
      headers: { "user-agent": "shimmy-ui" },
      cache: "no-store",
    }),
  );
  const result: HuggingFaceModel[] = [];
  for (const item of models) {
    const repoId = String(item.id ?? "").trim();
    if (!repoId) continue;
    const tags = (item.tags ?? []).slice(0, 20).map((tag) => String(tag));
    const model: HuggingFaceModel = {
      repoId,
      tags,
    };
    if (typeof item.downloads === "number") model.downloads = item.downloads;
    if (typeof item.likes === "number") model.likes = item.likes;
    if (typeof item.lastModified === "string") model.lastModified = item.lastModified;
    const fileCount = ggufFileCount(tags);
    if (typeof fileCount === "number") model.ggufFileCount = fileCount;
    result.push(model);
  }
  return result;
}

type HuggingFaceApiModelDetails = {
  siblings?: Array<{
    rfilename?: string;
    size?: number;
  }>;
};

function detectQuantization(fileName: string) {
  const leaf = fileName.split("/").at(-1) ?? fileName;
  const normalized = leaf.replace(/\.gguf$/i, "");
  const match = normalized.match(
    /(IQ\d(?:_[A-Z0-9]+)+|Q\d(?:_[A-Z0-9]+)+|BF16|FP16|F16|FP32|F32)$/i,
  );
  return match?.[1]?.toUpperCase();
}

export async function listHuggingFaceGgufFiles(
  repoId: string,
  { fetchImpl = fetch }: HuggingFaceOptions = {},
): Promise<HuggingFaceModelFile[]> {
  const trimmedRepoId = repoId.trim();
  if (!trimmedRepoId) throw new Error("Missing Hugging Face repo id");

  const details = await jsonResponse<HuggingFaceApiModelDetails>(
    await fetchImpl(
      `${huggingFaceBaseUrl}/api/models/${encodeRepoId(trimmedRepoId)}?blobs=true`,
      {
        headers: { "user-agent": "shimmy-ui" },
        cache: "no-store",
      },
    ),
  );

  const files: HuggingFaceModelFile[] = [];
  for (const item of details.siblings ?? []) {
    const name = String(item.rfilename ?? "").trim();
    if (!name.toLowerCase().endsWith(".gguf")) continue;
    const file: HuggingFaceModelFile = {
      name,
      quantization: detectQuantization(name),
      downloadUrl: huggingFaceDownloadUrl(trimmedRepoId, name),
    };
    if (typeof item.size === "number") file.sizeBytes = item.size;
    files.push(file);
  }
  return files.sort((left, right) => {
    const leftQ = left.quantization ?? "~";
    const rightQ = right.quantization ?? "~";
    return leftQ.localeCompare(rightQ) || left.name.localeCompare(right.name);
  });
}
