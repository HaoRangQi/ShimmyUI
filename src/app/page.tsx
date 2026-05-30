"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/dashboard/chat-panel";
import { ConfigPanel } from "@/components/dashboard/config-panel";
import { DiagnosticsPanel } from "@/components/dashboard/diagnostics-panel";
import { LogsPanel } from "@/components/dashboard/logs-panel";
import { ModelsPanel } from "@/components/dashboard/models-panel";
import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { RuntimePanel, type RuntimeStatus } from "@/components/dashboard/runtime-panel";
import { MobileNavigation, Sidebar } from "@/components/dashboard/sidebar";
import type {
  ChatHistoryItem,
  ChatPresetId,
  CatalogModel,
  DashboardTab,
  DiscoverSummary,
  GenerationSettings,
  ManagedModel,
  OllamaCatalogModel,
  OllamaModel,
  OllamaStatus,
} from "@/components/dashboard/types";
import { ConfirmDialog, Snackbar } from "@/components/ui";
import { dictionaries } from "@/lib/i18n";
import type {
  AppStatus,
  LogEntry,
  ShimmyModel,
  ShimmyUiConfig,
} from "@/lib/shimmy/types";

const defaultConfig: ShimmyUiConfig = {
  bindAddress: "127.0.0.1:11435",
  modelDirs: [],
  gpuBackend: "auto",
  language: "zh",
  theme: "dark",
};

type SnackbarState = {
  kind: "success" | "error" | "info";
  title: string;
  description?: string;
};

type RuntimeAction = "download" | "install" | "update" | "uninstall" | "rollback";

type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

const chatPresets: Record<ChatPresetId, GenerationSettings> = {
  precise: { temperature: 0.2, topP: 0.7, maxTokens: 128 },
  balanced: { temperature: 0.7, topP: 0.9, maxTokens: 128 },
  creative: { temperature: 1, topP: 0.95, maxTokens: 256 },
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
  }
  if (!response.ok) {
    throw new Error(data.error ?? response.statusText);
  }
  return data as T;
}

export default function Home() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [localConfig, setLocalConfig] = useState<ShimmyUiConfig>(defaultConfig);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("Say hi in five words.");
  const [chatOutput, setChatOutput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [logsFilter, setLogsFilter] = useState("");
  const [logsStream, setLogsStream] = useState<"all" | "stdout" | "stderr" | "system">("all");
  const [logsAutoScroll, setLogsAutoScroll] = useState(true);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [activeRuntimeAction, setActiveRuntimeAction] = useState<RuntimeAction | null>(null);
  const [discoverSummary, setDiscoverSummary] = useState<DiscoverSummary | null>(null);
  const [localGgufPath, setLocalGgufPath] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [ollamaQuery, setOllamaQuery] = useState("");
  const [ollamaModelName, setOllamaModelName] = useState("");
  const [editingManagedModel, setEditingManagedModel] = useState<string | null>(null);
  const [managedModelNameDraft, setManagedModelNameDraft] = useState("");
  const [generation, setGeneration] = useState<GenerationSettings>({
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 128,
  });
  const chatAbortController = useRef<AbortController | null>(null);

  const status = useQuery({
    queryKey: ["status"],
    queryFn: () => jsonFetch<AppStatus>("/api/app/status"),
  });
  const models = useQuery({
    queryKey: ["models"],
    queryFn: () => jsonFetch<{ models: ShimmyModel[] }>("/api/shimmy/models"),
    retry: false,
  });
  const logs = useQuery({
    queryKey: ["logs"],
    queryFn: () => jsonFetch<{ logs: LogEntry[] }>("/api/shimmy/logs"),
    refetchInterval: 2_000,
  });
  const runtime = useQuery({
    queryKey: ["runtime"],
    queryFn: () => jsonFetch<RuntimeStatus>("/api/runtime/status"),
  });
  const modelCatalog = useQuery({
    queryKey: ["model-library", "catalog", catalogQuery],
    queryFn: () =>
      jsonFetch<{ ok: boolean; models: CatalogModel[] }>(
        `/api/model-library/catalog?q=${encodeURIComponent(catalogQuery)}`,
      ),
  });
  const managedModels = useQuery({
    queryKey: ["model-library", "installed"],
    queryFn: () => jsonFetch<{ ok: boolean; models: ManagedModel[] }>("/api/model-library/installed"),
  });
  const ollamaStatus = useQuery({
    queryKey: ["model-library", "ollama-status"],
    queryFn: () => jsonFetch<{ ok: boolean; status: OllamaStatus }>("/api/model-library/ollama/status"),
  });
  const ollamaModels = useQuery({
    queryKey: ["model-library", "ollama-models"],
    queryFn: () => jsonFetch<{ ok: boolean; models: OllamaModel[] }>("/api/model-library/ollama/models"),
    enabled: Boolean(ollamaStatus.data?.status.running),
    retry: false,
  });
  const ollamaCatalog = useQuery({
    queryKey: ["model-library", "ollama-catalog", ollamaQuery],
    queryFn: () =>
      jsonFetch<{ ok: boolean; models: OllamaCatalogModel[] }>(
        `/api/model-library/ollama/search?q=${encodeURIComponent(ollamaQuery)}`,
      ),
  });
  const gpuInfo = useQuery({
    queryKey: ["gpu-info"],
    queryFn: () => jsonFetch<{ output: string }>("/api/shimmy/gpu-info"),
    enabled: tab === "diagnostics",
    retry: false,
  });

  const t = dictionaries[localConfig.language ?? "zh"];
  const modelRows = useMemo(() => models.data?.models ?? [], [models.data?.models]);
  const statusState = status.data?.state ?? "stopped";
  const endpoint = `http://${localConfig.bindAddress}`;
  const filteredLogs = useMemo(
    () =>
      (logs.data?.logs ?? []).filter((entry) => {
        const query = logsFilter.trim().toLowerCase();
        const streamMatches = logsStream === "all" || entry.stream === logsStream;
        if (!streamMatches) return false;
        if (!query) return true;
        return (
          entry.message.toLowerCase().includes(query) ||
          entry.stream.toLowerCase().includes(query)
        );
      }),
    [logs.data?.logs, logsFilter, logsStream],
  );

  useEffect(() => {
    if (status.data?.config && !settingsDirty) {
      setLocalConfig(status.data.config);
    }
  }, [settingsDirty, status.data?.config]);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");

    function applyTheme() {
      const useLight = localConfig.theme === "light";
      const useDark = localConfig.theme === "dark" || (localConfig.theme === "system" && media?.matches);
      root.lang = localConfig.language;
      root.classList.toggle("light", useLight);
      root.classList.toggle("dark", Boolean(useDark));
    }

    applyTheme();
    if (localConfig.theme !== "system" || !media) return;
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [localConfig.language, localConfig.theme]);

  useEffect(() => {
    const configured = localConfig.defaultModel;
    const first = modelRows[0]?.name;
    if (!selectedModel && configured) setSelectedModel(configured);
    if (!selectedModel && first) setSelectedModel(first);
  }, [localConfig.defaultModel, modelRows, selectedModel]);

  useEffect(() => {
    if (statusState === "running-managed" || statusState === "running-external") {
      queryClient.invalidateQueries({ queryKey: ["models"] });
    }
  }, [queryClient, statusState]);

  useEffect(() => {
    if (tab === "logs") {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
    }
  }, [queryClient, tab]);

  const start = useMutation({
    mutationFn: () => jsonFetch("/api/shimmy/start", { method: "POST" }),
    onSuccess: () => {
      setSnackbar({ kind: "success", title: t.startComplete });
      queryClient.invalidateQueries();
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const stop = useMutation({
    mutationFn: () => jsonFetch("/api/shimmy/stop", { method: "POST" }),
    onSuccess: () => {
      setSnackbar({ kind: "success", title: t.stopComplete });
      queryClient.invalidateQueries();
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const logout = useMutation({
    mutationFn: () => jsonFetch("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const saveSettings = useMutation({
    mutationFn: () =>
      jsonFetch("/api/app/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(localConfig),
      }),
    onSuccess: () => {
      setSettingsDirty(false);
      setSnackbar({ kind: "success", title: t.saveComplete });
      queryClient.invalidateQueries();
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const setDefaultModel = useMutation({
    mutationFn: (modelName: string) => {
      const nextConfig = { ...localConfig, defaultModel: modelName };
      setLocalConfig(nextConfig);
      return jsonFetch("/api/app/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextConfig),
      });
    },
    onSuccess: () => {
      setSettingsDirty(false);
      setSnackbar({ kind: "success", title: t.saveComplete });
      queryClient.invalidateQueries();
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const discover = useMutation({
    mutationFn: async () => {
      const startedAt = performance.now();
      const data = await jsonFetch<{ models: ShimmyModel[] }>("/api/shimmy/discover", {
        method: "POST",
      });
      return {
        modelsFound: data.models.length,
        elapsedMs: Math.round(performance.now() - startedAt),
      };
    },
    onSuccess: (summary) => {
      setDiscoverSummary(summary);
      setSnackbar({
        kind: "success",
        title: t.discoverComplete,
        description: `${t.discoveredModels}: ${summary.modelsFound} · ${t.elapsedMs}: ${summary.elapsedMs}ms`,
      });
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setDiscoverSummary({ modelsFound: 0, elapsedMs: 0, error: message });
      setSnackbar(errorToSnackbar(error, t));
    },
  });
  const runtimeAction = useMutation({
    mutationFn: ({
      action,
      url,
      body,
    }: {
      action: RuntimeAction;
      url: string;
      body?: unknown;
    }) => {
      setActiveRuntimeAction(action);
      return jsonFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    onSuccess: (_data, variables) => {
      setSnackbar({ kind: "success", title: runtimeSuccessLabel(variables.action, t) });
      queryClient.invalidateQueries({ queryKey: ["runtime"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
    onSettled: () => setActiveRuntimeAction(null),
  });
  const importLocalModel = useMutation({
    mutationFn: (modelPath: string) =>
      jsonFetch<{ ok: boolean; model: ManagedModel }>("/api/model-library/import-local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: modelPath }),
      }),
    onSuccess: () => {
      setLocalGgufPath("");
      setSnackbar({ kind: "success", title: t.modelImportComplete });
      invalidateModelLibrary(queryClient);
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const downloadCatalogModel = useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: boolean; model: ManagedModel }>("/api/model-library/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      setSnackbar({ kind: "success", title: t.modelDownloadComplete });
      invalidateModelLibrary(queryClient);
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const deleteManagedModel = useMutation({
    mutationFn: (name: string) =>
      jsonFetch<{ ok: boolean; deleted: string }>(
        `/api/model-library/installed/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      setSnackbar({ kind: "success", title: t.modelDeleteComplete });
      invalidateModelLibrary(queryClient);
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const renameManagedModel = useMutation({
    mutationFn: ({ name, nextName }: { name: string; nextName: string }) =>
      jsonFetch<{ ok: boolean; model: ManagedModel }>(
        `/api/model-library/installed/${encodeURIComponent(name)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: nextName }),
        },
      ),
    onSuccess: () => {
      setEditingManagedModel(null);
      setManagedModelNameDraft("");
      setSnackbar({ kind: "success", title: t.modelRenameComplete });
      invalidateModelLibrary(queryClient);
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const startOllama = useMutation({
    mutationFn: () => jsonFetch<{ ok: boolean; started: boolean }>("/api/model-library/ollama/start", { method: "POST" }),
    onSuccess: () => {
      setSnackbar({ kind: "success", title: t.ollamaStarted });
      queryClient.invalidateQueries({ queryKey: ["model-library", "ollama-status"] });
      queryClient.invalidateQueries({ queryKey: ["model-library", "ollama-models"] });
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const pullOllamaModel = useMutation({
    mutationFn: (model: string) =>
      jsonFetch<{ ok: boolean; model: string }>("/api/model-library/ollama/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model }),
      }),
    onSuccess: () => {
      setSnackbar({ kind: "success", title: t.ollamaPullComplete });
      queryClient.invalidateQueries({ queryKey: ["model-library", "ollama-status"] });
      queryClient.invalidateQueries({ queryKey: ["model-library", "ollama-models"] });
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });
  const deleteOllamaModel = useMutation({
    mutationFn: (model: string) =>
      jsonFetch<{ ok: boolean; deleted: string }>("/api/model-library/ollama/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model }),
      }),
    onSuccess: () => {
      setSnackbar({ kind: "success", title: t.ollamaDeleteComplete });
      queryClient.invalidateQueries({ queryKey: ["model-library", "ollama-models"] });
    },
    onError: (error) => setSnackbar(errorToSnackbar(error, t)),
  });

  async function runChat() {
    const prompt = chatPrompt.trim();
    if (!selectedModel || !prompt) return;
    const controller = new AbortController();
    chatAbortController.current = controller;
    setChatBusy(true);
    setChatOutput("");
    try {
      const response = await runChatRequest(selectedModel, prompt, controller.signal);
      rememberChat({ model: selectedModel, prompt, response });
      setSnackbar({ kind: "success", title: t.chatComplete });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Chat failed";
      setChatOutput(message);
      setSnackbar(errorToSnackbar(message, t));
    } finally {
      if (chatAbortController.current === controller) {
        chatAbortController.current = null;
      }
      setChatBusy(false);
    }
  }

  async function runChatRequest(modelName: string, prompt: string, signal?: AbortSignal) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        model: modelName,
        stream: true,
        messages: [{ role: "user", content: prompt }],
        temperature: generation.temperature,
        top_p: generation.topP,
        max_tokens: generation.maxTokens,
      }),
    });
    if (!response.ok || !response.body) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        const clean = line.replace(/^data:\s*/, "").trim();
        if (!clean || clean === "[DONE]") continue;
        try {
          const parsed = JSON.parse(clean);
          const token =
            parsed.choices?.[0]?.delta?.content ??
            parsed.choices?.[0]?.text ??
            "";
          output += token;
          setChatOutput(output);
        } catch {
          output += clean;
          setChatOutput(output);
        }
      }
    }
    return output;
  }

  function stopChat() {
    chatAbortController.current?.abort();
    setChatBusy(false);
    setSnackbar({ kind: "info", title: t.generationStopped });
  }

  function rememberChat({
    model,
    prompt,
    response,
  }: {
    model: string;
    prompt: string;
    response: string;
  }) {
    setChatHistory((current) => [
      {
        id: `${Date.now()}-${current.length}`,
        model,
        prompt,
        response,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 12));
  }

  function copyResponse(response: string) {
    void navigator.clipboard?.writeText(response);
    setSnackbar({ kind: "success", title: t.copyResponse });
  }

  function applyPreset(preset: ChatPresetId) {
    setGeneration(chatPresets[preset]);
  }

  function restoreHistory(item: ChatHistoryItem) {
    setSelectedModel(item.model);
    setChatPrompt(item.prompt);
    setChatOutput(item.response);
  }

  async function probe(modelName: string) {
    const result = await jsonFetch<{ ok: boolean; output: string }>(
      "/api/shimmy/probe",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      },
    ).catch((error) => ({
      ok: false,
      output: error instanceof Error ? error.message : "Probe failed",
    }));
    setChatOutput(result.output);
    setSelectedModel(modelName);
    setTab("chat");
  }

  function runRuntimeAction(action: RuntimeAction, url: string, body?: unknown) {
    runtimeAction.mutate({ action, url, body });
  }

  function confirmUninstall() {
    setConfirm({
      title: t.uninstallTitle,
      description: t.uninstallDescription,
      confirmLabel: t.confirmUninstall,
      destructive: true,
      onConfirm: () => runRuntimeAction("uninstall", "/api/runtime/uninstall"),
    });
  }

  function confirmRollback(backupPath?: string) {
    setConfirm({
      title: t.rollbackTitle,
      description: t.rollbackDescription,
      confirmLabel: t.confirmRollback,
      onConfirm: () =>
        runRuntimeAction(
          "rollback",
          "/api/runtime/rollback",
          backupPath ? { backupPath } : {},
        ),
    });
  }

  async function runSmokeTest() {
    const modelName = selectedModel || localConfig.defaultModel || modelRows[0]?.name;
    if (!modelName) {
      setTab("chat");
      setSnackbar({
        kind: "error",
        title: t.operationFailed,
        description: t.noModelAdvice,
      });
      return;
    }
    setSelectedModel(modelName);
    setChatPrompt(t.smokePrompt);
    setChatOutput("");
    setChatBusy(true);
    setTab("chat");
    setSnackbar({ kind: "info", title: t.smokeTestStarted });
    const controller = new AbortController();
    chatAbortController.current = controller;
    try {
      const response = await runChatRequest(modelName, t.smokePrompt, controller.signal);
      rememberChat({ model: modelName, prompt: t.smokePrompt, response });
      setSnackbar({ kind: "success", title: t.chatComplete });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Chat failed";
      setChatOutput(message);
      setSnackbar(errorToSnackbar(message, t));
    } finally {
      if (chatAbortController.current === controller) {
        chatAbortController.current = null;
      }
      setChatBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-3 py-3 pb-24 sm:px-5 lg:px-6 lg:pb-3">
      <div className="mx-auto grid max-w-[1520px] gap-5 lg:grid-cols-[268px_1fr]">
        <Sidebar
          t={t}
          tab={tab}
          setTab={setTab}
          statusState={statusState}
          start={() => start.mutate()}
          stop={() => stop.mutate()}
          logout={() => logout.mutate()}
          startPending={start.isPending}
          stopPending={stop.isPending}
          logoutPending={logout.isPending}
        />

        <section className="min-w-0 rounded-[32px] bg-[rgb(var(--surface-container-low))]/55 p-3 shadow-glow sm:p-4">
          {tab === "overview" ? (
            <OverviewPanel
              t={t}
              status={status.data}
              statusState={statusState}
              modelRows={modelRows}
              endpoint={endpoint}
              refreshAll={() => queryClient.invalidateQueries()}
              setTab={setTab}
              runSmokeTest={runSmokeTest}
            />
          ) : null}
          {tab === "models" ? (
            <ModelsPanel
              t={t}
              modelRows={modelRows}
              defaultModel={localConfig.defaultModel}
              catalogModels={modelCatalog.data?.models ?? []}
              managedModels={managedModels.data?.models ?? []}
              ollamaStatus={ollamaStatus.data?.status}
              ollamaModels={ollamaModels.data?.models ?? []}
              ollamaCatalogModels={ollamaCatalog.data?.models ?? []}
              localGgufPath={localGgufPath}
              catalogQuery={catalogQuery}
              ollamaQuery={ollamaQuery}
              ollamaModelName={ollamaModelName}
              editingManagedModel={editingManagedModel}
              managedModelNameDraft={managedModelNameDraft}
              modelLibraryPending={
                importLocalModel.isPending ||
                downloadCatalogModel.isPending ||
                deleteManagedModel.isPending ||
                renameManagedModel.isPending
              }
              ollamaPending={startOllama.isPending || pullOllamaModel.isPending || deleteOllamaModel.isPending}
              modelDirsHealth={status.data?.modelDirsHealth}
              discoverPending={discover.isPending}
              discoverSummary={discoverSummary}
              discover={() => discover.mutate()}
              setLocalGgufPath={setLocalGgufPath}
              setCatalogQuery={setCatalogQuery}
              setOllamaQuery={setOllamaQuery}
              setOllamaModelName={setOllamaModelName}
              setEditingManagedModel={setEditingManagedModel}
              setManagedModelNameDraft={setManagedModelNameDraft}
              importLocalGguf={() => {
                const modelPath = localGgufPath.trim();
                if (modelPath) importLocalModel.mutate(modelPath);
              }}
              downloadCatalogModel={(modelId) => downloadCatalogModel.mutate(modelId)}
              deleteManagedModel={(modelName) => deleteManagedModel.mutate(modelName)}
              renameManagedModel={(modelName, nextName) =>
                renameManagedModel.mutate({ name: modelName, nextName })
              }
              startOllama={() => startOllama.mutate()}
              pullOllamaModel={(modelName) => {
                const nextModel = modelName.trim();
                if (nextModel) pullOllamaModel.mutate(nextModel);
              }}
              deleteOllamaModel={(modelName) => deleteOllamaModel.mutate(modelName)}
              openChat={(modelName) => {
                setSelectedModel(modelName);
                setTab("chat");
              }}
              probe={probe}
              setDefaultModel={(modelName) => setDefaultModel.mutate(modelName)}
            />
          ) : null}
          {tab === "chat" ? (
            <ChatPanel
              t={t}
              modelRows={modelRows}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              generation={generation}
              setGeneration={setGeneration}
              chatPrompt={chatPrompt}
              setChatPrompt={setChatPrompt}
              chatOutput={chatOutput}
              chatBusy={chatBusy}
              runChat={runChat}
              stopChat={stopChat}
              copyResponse={copyResponse}
              applyPreset={applyPreset}
              chatHistory={chatHistory}
              restoreHistory={restoreHistory}
            />
          ) : null}
          {tab === "runtime" ? (
            <RuntimePanel
              t={t}
              runtime={runtime.data}
              busy={runtimeAction.isPending || runtime.isFetching}
              activeAction={activeRuntimeAction}
              refresh={() => queryClient.invalidateQueries({ queryKey: ["runtime"] })}
              download={() => runRuntimeAction("download", "/api/runtime/download")}
              install={() =>
                runRuntimeAction(
                  "install",
                  "/api/runtime/install",
                  { useExistingDownload: true },
                )
              }
              update={() => runRuntimeAction("update", "/api/runtime/update")}
              confirmUninstall={confirmUninstall}
              confirmRollback={confirmRollback}
            />
          ) : null}
          {tab === "config" ? (
            <ConfigPanel
              t={t}
              localConfig={localConfig}
              modelDirsHealth={status.data?.modelDirsHealth}
              setLocalConfig={setLocalConfig}
              markDirty={() => setSettingsDirty(true)}
              saveSettings={() => saveSettings.mutate()}
              savePending={saveSettings.isPending}
            />
          ) : null}
          {tab === "logs" ? (
            <LogsPanel
              t={t}
              logsFilter={logsFilter}
              setLogsFilter={setLogsFilter}
              filteredLogs={filteredLogs}
              logsStream={logsStream}
              setLogsStream={setLogsStream}
              autoScroll={logsAutoScroll}
              setAutoScroll={setLogsAutoScroll}
              clearLogs={async () => {
                await fetch("/api/shimmy/logs", { method: "DELETE" });
                setSnackbar({ kind: "success", title: t.clear });
                queryClient.invalidateQueries({ queryKey: ["logs"] });
              }}
            />
          ) : null}
          {tab === "diagnostics" ? (
            <DiagnosticsPanel
              t={t}
              status={status.data}
              runtime={runtime.data}
              modelRows={modelRows}
              endpoint={endpoint}
              gpuInfo={gpuInfo.data?.output ?? gpuInfo.error?.message}
              refresh={() => {
                queryClient.invalidateQueries({ queryKey: ["status"] });
                queryClient.invalidateQueries({ queryKey: ["runtime"] });
                queryClient.invalidateQueries({ queryKey: ["models"] });
                queryClient.invalidateQueries({ queryKey: ["gpu-info"] });
              }}
            />
          ) : null}
        </section>
      </div>

      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={t.cancel}
          destructive={confirm.destructive}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const onConfirm = confirm.onConfirm;
            setConfirm(null);
            onConfirm();
          }}
        />
      ) : null}

      {snackbar ? (
        <Snackbar
          kind={snackbar.kind}
          title={snackbar.title}
          description={snackbar.description}
          onDismiss={() => setSnackbar(null)}
        />
      ) : null}
      <MobileNavigation t={t} tab={tab} setTab={setTab} />
    </main>
  );
}

function runtimeSuccessLabel(action: RuntimeAction, t: typeof dictionaries.en) {
  if (action === "download") return t.downloadComplete;
  if (action === "install") return t.installComplete;
  if (action === "update") return t.updateComplete;
  if (action === "uninstall") return t.uninstallComplete;
  return t.rollbackComplete;
}

function invalidateModelLibrary(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["model-library"] });
  queryClient.invalidateQueries({ queryKey: ["models"] });
  queryClient.invalidateQueries({ queryKey: ["status"] });
}

function errorToSnackbar(error: unknown, t: typeof dictionaries.en): SnackbarState {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("already running") || lower.includes("runtime operation")) {
    return {
      kind: "error",
      title: t.operationRunning,
      description: t.runtimeBusyAdvice,
    };
  }
  if (lower.includes("checksum")) {
    return {
      kind: "error",
      title: t.checksumFailure,
      description: t.checksumFailureAdvice,
    };
  }
  if (lower.includes("download failed") || lower.includes("github request failed") || lower.includes("network")) {
    return {
      kind: "error",
      title: t.networkFailure,
      description: t.networkFailureAdvice,
    };
  }
  if (lower.includes("missing") || lower.includes("not found") || lower.includes("not executable")) {
    return {
      kind: "error",
      title: t.missingRuntimeFile,
      description: lower.includes("shimmy binary") ? t.missingBinaryAdvice : t.missingRuntimeFileAdvice,
    };
  }
  if (lower.includes("eaddrinuse") || lower.includes("address already in use")) {
    return {
      kind: "error",
      title: t.portConflict,
      description: t.portConflictAdvice,
    };
  }
  if (lower.includes("no model") || lower.includes("model")) {
    return {
      kind: "error",
      title: t.operationFailed,
      description: t.noModelAdvice,
    };
  }

  return {
    kind: "error",
    title: t.operationFailed,
    description: message,
  };
}
