import type { CatalogModel } from "./types";

export const catalogModels: CatalogModel[] = [
  {
    id: "tinyllama-1.1b-chat-q2-k",
    name: "TinyLlama 1.1B Chat Q2_K",
    family: "llama",
    architecture: "llama",
    quantization: "Q2_K",
    sizeBytes: 483_116_416,
    url: "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q2_K.gguf",
    sha256: "030a469a63576d59f601ef5608846b7718eaa884dd820e9aa7493efec1788afa",
    license: "Apache-2.0",
    minRamGb: 3,
    tags: ["small", "chat", "fast", "low-memory"],
    description: "Smallest curated TinyLlama GGUF for quick local smoke tests.",
    compatibility: {
      format: "gguf",
      shimmyProbeKnownGood: true,
    },
  },
  {
    id: "tinyllama-1.1b-chat-q4-k-m",
    name: "TinyLlama 1.1B Chat Q4_K_M",
    family: "llama",
    architecture: "llama",
    quantization: "Q4_K_M",
    sizeBytes: 668_788_096,
    url: "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
    sha256: "9fecc3b3cd76bba89d504f29b616eedf7da85b96540e490ca5824d3f7d2776a0",
    license: "Apache-2.0",
    minRamGb: 4,
    tags: ["small", "chat", "balanced", "recommended"],
    description: "Balanced TinyLlama GGUF for first-run chat validation.",
    compatibility: {
      format: "gguf",
      shimmyProbeKnownGood: true,
    },
  },
  {
    id: "tinyllama-1.1b-chat-q5-k-m",
    name: "TinyLlama 1.1B Chat Q5_K_M",
    family: "llama",
    architecture: "llama",
    quantization: "Q5_K_M",
    sizeBytes: 783_017_344,
    url: "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q5_K_M.gguf",
    sha256: "aa54a5fb99ace5b964859cf072346631b2da6109715a805d07161d157c66ce7f",
    license: "Apache-2.0",
    minRamGb: 5,
    tags: ["small", "chat", "quality"],
    description: "Higher quality TinyLlama GGUF for machines with more RAM.",
    compatibility: {
      format: "gguf",
      shimmyProbeKnownGood: true,
    },
  },
];

export function compatibleCatalogModels(models = catalogModels, query = "") {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return models.filter(
    (model) =>
      model.compatibility.format === "gguf" &&
      model.compatibility.shimmyProbeKnownGood &&
      /^[a-f0-9]{64}$/i.test(model.sha256) &&
      model.url.toLowerCase().endsWith(".gguf") &&
      terms.every((term) => catalogSearchText(model).includes(term)),
  );
}

function catalogSearchText(model: CatalogModel) {
  return [
    model.id,
    model.name,
    model.family,
    model.architecture,
    model.quantization,
    model.license,
    model.description,
    ...(model.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
