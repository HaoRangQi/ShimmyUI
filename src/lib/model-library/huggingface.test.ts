import { describe, expect, it, vi } from "vitest";
import {
  huggingFaceDownloadUrl,
  listHuggingFaceGgufFiles,
  searchHuggingFaceModels,
} from "./huggingface";

describe("huggingface model library", () => {
  it("searches GGUF repositories from Hugging Face API", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        {
          id: "unsloth/Qwen3.5-9B-GGUF",
          downloads: 123,
          likes: 10,
          lastModified: "2026-05-30T00:00:00.000Z",
          tags: ["gguf", "text-generation"],
        },
      ]),
    );

    const models = await searchHuggingFaceModels({
      query: "qwen",
      limit: 10,
      sort: "downloads",
      fetchImpl: fetchMock,
    });

    expect(models).toEqual([
      expect.objectContaining({
        repoId: "unsloth/Qwen3.5-9B-GGUF",
        downloads: 123,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/models?"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("lists GGUF files and detects quantization", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        siblings: [
          { rfilename: "Qwen3.5-9B-Q4_K_M.gguf", size: 100 },
          { rfilename: "README.md", size: 20 },
          { rfilename: "Qwen3.5-9B-IQ4_NL.gguf", size: 120 },
        ],
      }),
    );

    const files = await listHuggingFaceGgufFiles("unsloth/Qwen3.5-9B-GGUF", {
      fetchImpl: fetchMock,
    });

    expect(files).toEqual([
      expect.objectContaining({
        name: "Qwen3.5-9B-IQ4_NL.gguf",
        quantization: "IQ4_NL",
      }),
      expect.objectContaining({
        name: "Qwen3.5-9B-Q4_K_M.gguf",
        quantization: "Q4_K_M",
      }),
    ]);
  });

  it("builds a resolvable Hugging Face download url", () => {
    expect(
      huggingFaceDownloadUrl("unsloth/Qwen3.5-9B-GGUF", "models/Qwen3.5-9B-Q4_K_M.gguf"),
    ).toBe(
      "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/models/Qwen3.5-9B-Q4_K_M.gguf?download=true",
    );
  });
});
