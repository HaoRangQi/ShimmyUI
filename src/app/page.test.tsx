import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const statusResponse = {
  state: "missing-binary",
  config: {
    bindAddress: "127.0.0.1:11435",
    modelDirs: [],
    gpuBackend: "auto",
    language: "zh",
    theme: "system",
  },
  binary: null,
  health: { ok: false },
  metrics: { ok: false },
  modelDirsHealth: {
    configured: false,
    directories: [],
    totalGgufFiles: 0,
    hasReadableDirectory: false,
    hasModels: false,
  },
  logsCount: 0,
};

const runtimeResponse = {
  managedPath: "/tmp/shimmy-ui/bin/shimmy",
  installed: true,
  installedByUi: true,
  currentVersion: "v1.0.0",
  installedVersion: "v1.0.0",
  installedDigest: "sha256:abc",
  installedAssetName: "shimmy",
  installedAt: "2026-05-29T00:00:00.000Z",
  latestRelease: {
    tagName: "v1.0.0",
    asset: {
      name: "shimmy",
      downloadUrl: "https://example.test/shimmy",
      digest: "sha256:abc",
    },
  },
  updateAvailable: false,
  downloads: [],
  backups: [
    {
      version: "v0.9.0",
      digest: "sha256:def",
      path: "/tmp/shimmy-ui/backups/shimmy-v0.9.0",
      createdAt: "2026-05-28T00:00:00.000Z",
    },
  ],
  canUninstall: true,
  canRollback: true,
};

function renderHome(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Home />
    </QueryClientProvider>,
  );
}

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/app/status") return Response.json(statusResponse);
    if (url === "/api/shimmy/models") return Response.json({ models: [] });
    if (url === "/api/shimmy/logs") return Response.json({ logs: [] });
    if (url === "/api/runtime/status") return Response.json(runtimeResponse);
    if (url.startsWith("/api/model-library/catalog")) {
      return Response.json({
        ok: true,
        models: [
          {
            id: "tiny",
            name: "Tiny GGUF",
            family: "llama",
            architecture: "llama",
            quantization: "Q4_K_M",
            sizeBytes: 12,
            license: "Apache-2.0",
            tags: ["small", "chat"],
            compatibility: { format: "gguf", shimmyProbeKnownGood: true },
          },
        ],
      });
    }
    if (url === "/api/model-library/installed") {
      return Response.json({ ok: true, models: [] });
    }
    if (url === "/api/model-library/ollama/status") {
      return Response.json({
        ok: true,
        status: {
          installed: true,
          running: false,
          baseUrl: "http://127.0.0.1:11434",
          error: "connect ECONNREFUSED",
        },
      });
    }
    if (url === "/api/model-library/ollama/models") {
      return Response.json({ ok: true, models: [] });
    }
    if (url.startsWith("/api/model-library/ollama/search")) {
      return Response.json({
        ok: true,
        models: [
          {
            name: "qwen2.5:1.5b",
            family: "qwen",
            sizeLabel: "1.5B",
            description: "Small multilingual chat model.",
            tags: ["chat", "small"],
          },
        ],
      });
    }
    if (url === "/api/model-library/import-local" && init?.method === "POST") {
      return Response.json({
        ok: true,
        model: {
          name: "tiny.gguf",
          path: "/tmp/tiny.gguf",
          sizeBytes: 12,
          source: "local",
          importedAt: "2026-05-29T00:00:00.000Z",
        },
      });
    }
    if (url === "/api/model-library/download" && init?.method === "POST") {
      return Response.json({
        ok: true,
        model: {
          name: "tiny.gguf",
          path: "/tmp/tiny.gguf",
          sizeBytes: 12,
          source: "catalog",
          importedAt: "2026-05-29T00:00:00.000Z",
        },
      });
    }
    if (url === "/api/model-library/installed/tiny.gguf" && init?.method === "DELETE") {
      return Response.json({ ok: true, deleted: "tiny.gguf" });
    }
    if (url === "/api/model-library/ollama/start" && init?.method === "POST") {
      return Response.json({ ok: true, started: true });
    }
    if (url === "/api/model-library/ollama/pull" && init?.method === "POST") {
      return Response.json({ ok: true, model: "qwen2.5:1.5b" });
    }
    if (url === "/api/model-library/ollama/delete" && init?.method === "POST") {
      return Response.json({ ok: true, deleted: "llama3.2:latest" });
    }
    if (url === "/api/runtime/uninstall" && init?.method === "POST") {
      return Response.json({ ok: true, uninstalled: true });
    }
    if (url === "/api/runtime/rollback" && init?.method === "POST") {
      return Response.json({ ok: true, rolledBackTo: runtimeResponse.backups[0] });
    }
    if (url === "/api/runtime/download" && init?.method === "POST") {
      return Response.json({ ok: false, error: "Download failed: 503 Service Unavailable" }, { status: 500 });
    }
    return Response.json({ ok: true });
  });
}

describe("Home dashboard P0 trusted operations", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query.includes("dark"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies system theme from the OS preference", async () => {
    renderHome(createFetchMock());

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
    });
    expect(document.documentElement).not.toHaveClass("light");
  });

  it("does not uppercase Chinese field labels", async () => {
    renderHome(createFetchMock());
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: "配置" }))[0]);

    const shimmyLabel = screen.getByText("Shimmy 路径");
    expect(shimmyLabel).not.toHaveClass("uppercase");
  });

  it("requires confirmation before uninstalling the managed runtime", async () => {
    const fetchMock = createFetchMock();
    renderHome(fetchMock);
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: "运行时" }))[0]);
    await user.click(await screen.findByRole("button", { name: "卸载" }));

    expect(screen.getByRole("dialog", { name: "确认卸载" })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/runtime/uninstall",
      expect.objectContaining({ method: "POST" }),
    );

    await user.click(screen.getByRole("button", { name: "确认卸载" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/runtime/uninstall",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("卸载完成");
  });

  it("shows a localized snackbar suggestion for failed runtime actions", async () => {
    renderHome(createFetchMock());
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: "运行时" }))[0]);
    await user.click(await screen.findByRole("button", { name: "下载" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("网络请求失败");
    expect(screen.getByRole("alert")).toHaveTextContent("检查网络连接后重试");
  });

  it("shows a task-oriented setup checklist on the overview", async () => {
    renderHome(createFetchMock());
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "首次设置" })).toBeVisible();
    expect(screen.getByText("安装或选择 Shimmy")).toBeVisible();
    expect(screen.getByText("配置模型目录")).toBeVisible();
    expect(screen.getByText("发现模型")).toBeVisible();
    expect(screen.getByText("启动服务")).toBeVisible();
    expect(screen.getByText("发送测试消息")).toBeVisible();

    await user.click(screen.getAllByRole("button", { name: "去运行时" })[0]);
    expect(await screen.findByRole("heading", { name: "运行时" })).toBeVisible();
  });

  it("shows diagnostics and log operation controls", async () => {
    renderHome(createFetchMock());
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: "诊断" }))[0]);
    expect(await screen.findByRole("heading", { name: "诊断" })).toBeVisible();
    expect(screen.getByText("诊断报告")).toBeVisible();

    await user.click(screen.getAllByRole("button", { name: "日志" })[0]);
    expect(await screen.findByRole("heading", { name: "日志" })).toBeVisible();
    expect(screen.getByRole("combobox")).toHaveValue("all");
    expect(screen.getByLabelText("自动滚动")).toBeChecked();
    expect(screen.getByRole("button", { name: "导出" })).toBeVisible();
  });

  it("shows model library controls and imports local GGUF paths", async () => {
    const fetchMock = createFetchMock();
    renderHome(fetchMock);
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: "模型" }))[0]);

    expect(await screen.findByRole("heading", { name: "模型库" })).toBeVisible();
    expect(screen.getByText("Tiny GGUF")).toBeVisible();
    expect(screen.getByText("Ollama 未运行")).toBeVisible();

    await user.type(screen.getByLabelText("本地 GGUF 路径"), "/tmp/tiny.gguf");
    await user.click(screen.getByRole("button", { name: "导入本地 GGUF" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/model-library/import-local",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ path: "/tmp/tiny.gguf" }),
        }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("模型导入完成");
  });

  it("searches and downloads catalog and Ollama models from dedicated controls", async () => {
    const fetchMock = createFetchMock();
    renderHome(fetchMock);
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: "模型" }))[0]);

    await user.type(await screen.findByLabelText("搜索 GGUF 模型"), "tiny");
    expect(await screen.findByText("Tiny GGUF")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "下载并验证" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/model-library/download",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ id: "tiny" }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "启动 Ollama" }));
    await user.type(screen.getByLabelText("自定义 Ollama 模型"), "qwen2.5:1.5b");
    await user.click(screen.getByRole("button", { name: "下载自定义模型" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/model-library/ollama/pull",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ model: "qwen2.5:1.5b" }),
        }),
      );
    });
    expect(screen.getByText("qwen2.5:1.5b")).toBeVisible();
  });
});
