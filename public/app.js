const dictionaries = {
  en: {
    missingBinary: "Shimmy not found",
    stopped: "Stopped",
    starting: "Starting",
    managed: "Managed service",
    external: "External service",
    error: "Error",
    setupHint: "Choose a Shimmy executable in Config, or install the Shimmy runtime from the Runtime page.",
    defaultModel: "Default",
    setDefault: "Set default",
    appName: "Shimmy UI",
    subtitle: "Local inference operations console",
    overview: "Overview",
    models: "Models",
    chat: "Chat",
    config: "Config",
    logs: "Logs",
    runtime: "Runtime",
    start: "Start",
    stop: "Stop",
    refresh: "Refresh",
    discover: "Discover",
    service: "Service",
    gpu: "GPU",
    modelCount: "Models",
    memory: "Memory",
    binary: "Binary",
    managedPid: "Managed PID",
    model: "Model",
    source: "Source",
    size: "Size",
    type: "Type",
    params: "Params",
    action: "Action",
    temperature: "Temperature",
    topP: "Top P",
    maxTokens: "Max Tokens",
    prompt: "Prompt",
    send: "Send",
    shimmyPath: "Shimmy path",
    bindAddress: "Bind address",
    modelDirs: "Model directories",
    baseGguf: "Base GGUF",
    maxCtx: "Context window",
    gpuBackend: "GPU backend",
    language: "Language",
    theme: "Theme",
    save: "Save",
    copy: "Copy",
    clear: "Clear",
    filter: "filter",
    selectModel: "Select model",
    noLogs: "No logs yet.",
    download: "Download",
    install: "Install",
    update: "Update",
    uninstall: "Uninstall",
    rollback: "Rollback",
    latest: "Latest",
    installed: "Installed",
    checksum: "Checksum",
    asset: "Asset",
    version: "Version",
    path: "Path",
    yes: "yes",
    no: "no",
    managedPath: "Managed path",
    backups: "Backups",
    updateAvailable: "Update available",
    noBackups: "No rollback backups yet.",
    runtimeHint: "Downloads and uninstall only affect the Shimmy UI managed binary.",
  },
  zh: {
    missingBinary: "未找到 Shimmy",
    stopped: "已停止",
    starting: "启动中",
    managed: "托管服务",
    external: "外部服务",
    error: "错误",
    setupHint: "请在配置里选择 Shimmy 程序，或到运行时页面安装 Shimmy。",
    defaultModel: "默认",
    setDefault: "设为默认",
    appName: "Shimmy UI",
    subtitle: "本地推理运维控制台",
    overview: "概览",
    models: "模型",
    chat: "对话",
    config: "配置",
    logs: "日志",
    runtime: "运行时",
    start: "启动",
    stop: "停止",
    refresh: "刷新",
    discover: "发现",
    service: "服务",
    gpu: "GPU",
    modelCount: "模型数",
    memory: "内存",
    binary: "二进制",
    managedPid: "托管 PID",
    model: "模型",
    source: "来源",
    size: "大小",
    type: "类型",
    params: "参数",
    action: "操作",
    temperature: "Temperature",
    topP: "Top P",
    maxTokens: "Max Tokens",
    prompt: "提示词",
    send: "发送",
    shimmyPath: "Shimmy 路径",
    bindAddress: "绑定地址",
    modelDirs: "模型目录",
    baseGguf: "Base GGUF",
    maxCtx: "上下文窗口",
    gpuBackend: "GPU backend",
    language: "语言",
    theme: "主题",
    save: "保存",
    copy: "复制",
    clear: "清空",
    filter: "过滤",
    selectModel: "选择模型",
    noLogs: "暂无日志。",
    download: "下载",
    install: "安装",
    update: "更新",
    uninstall: "卸载",
    rollback: "回滚",
    latest: "最新",
    installed: "已安装",
    checksum: "校验",
    asset: "Asset",
    version: "版本",
    path: "路径",
    yes: "是",
    no: "否",
    managedPath: "托管路径",
    backups: "备份",
    updateAvailable: "可更新",
    noBackups: "还没有可回滚备份。",
    runtimeHint: "下载和卸载只影响 Shimmy UI 托管的二进制。",
  },
};

const state = {
  status: null,
  models: [],
  logs: [],
  runtime: null,
  config: null,
  tab: "overview",
};

const $ = (selector) => document.querySelector(selector);

async function api(path, options) {
  const response = await fetch(path, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

function t(key) {
  return dictionaries[state.config?.language || "zh"][key] || key;
}

function serviceLabel(value) {
  return {
    "missing-binary": t("missingBinary"),
    stopped: t("stopped"),
    starting: t("starting"),
    "running-managed": t("managed"),
    "running-external": t("external"),
    error: t("error"),
  }[value] || value;
}

function serviceTone(value) {
  if (value === "running-managed" || value === "running-external") return "ok";
  if (value === "starting") return "warn";
  if (value === "missing-binary" || value === "error") return "error";
  return "idle";
}

function size(value) {
  if (!value) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[unit]}`;
}

function fillConfig() {
  const config = state.config || {};
  $("#shimmy-path").value = config.shimmyPath || "";
  $("#bind-address").value = config.bindAddress || "127.0.0.1:11435";
  $("#model-dirs").value = (config.modelDirs || []).join(";");
  $("#base-gguf").value = config.baseGguf || "";
  $("#max-ctx").value = config.maxCtx || "";
  $("#gpu-backend").value = config.gpuBackend || "auto";
  $("#language").value = config.language || "zh";
  $("#theme").value = config.theme || "dark";
  document.documentElement.lang = config.language || "zh";
  document.documentElement.classList.toggle("light", config.theme === "light");
  renderI18n();
}

function configFromForm() {
  return {
    ...state.config,
    shimmyPath: $("#shimmy-path").value.trim() || undefined,
    bindAddress: $("#bind-address").value.trim(),
    modelDirs: $("#model-dirs").value.split(";").map((x) => x.trim()).filter(Boolean),
    baseGguf: $("#base-gguf").value.trim() || undefined,
    maxCtx: $("#max-ctx").value ? Number($("#max-ctx").value) : undefined,
    gpuBackend: $("#gpu-backend").value,
    language: $("#language").value,
    theme: $("#theme").value,
  };
}

function renderStatus() {
  const status = state.status;
  if (!status) return;
  state.config = status.config;
  const label = serviceLabel(status.state);
  const pill = $("#status-pill");
  pill.className = `status-pill ${serviceTone(status.state)}`;
  pill.textContent = label;
  $("#setup-hint").textContent = t("setupHint");
  $("#setup-hint").classList.toggle("hidden", status.state !== "missing-binary");
  $("#stat-service").textContent = label;
  $("#stat-gpu").textContent = status.metrics?.gpuVendor || (status.metrics?.gpuDetected ? "detected" : "-");
  $("#stat-models").textContent = status.health?.modelsTotal ?? state.models.length ?? "-";
  $("#stat-memory").textContent = status.metrics?.memoryAvailableMb ? `${status.metrics.memoryAvailableMb} MB` : "-";
  $("#endpoint").textContent = `http://${status.config.bindAddress}`;
  $("#binary-path").textContent = status.binary?.path || "Not found";
  $("#managed-pid").textContent = status.managedPid || "-";
  $("#start-btn").disabled = status.state === "missing-binary" || status.state === "running-managed" || status.state === "running-external";
  $("#stop-btn").disabled = status.state !== "running-managed";
  fillConfig();
}

function renderModels() {
  const body = $("#models-body");
  body.textContent = "";
  for (const model of state.models) {
    const row = document.createElement("tr");
    for (const value of [
      model.name,
      model.source,
      size(model.sizeBytes),
      model.modelType || "-",
      model.parameterCount || "-",
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }

    const actions = document.createElement("td");
    actions.className = "row-actions";
    for (const [key, label] of [
      ["chat", t("chat")],
      ["probe", t("probe")],
      ["default", state.config?.defaultModel === model.name ? t("defaultModel") : t("setDefault")],
    ]) {
      const button = document.createElement("button");
      button.className = "secondary";
      button.dataset[key] = model.name;
      button.textContent = label;
      actions.append(button);
    }
    row.append(actions);
    body.append(row);
  }
  const select = $("#chat-model");
  select.textContent = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("selectModel");
  select.append(placeholder);
  for (const model of state.models) {
    const option = document.createElement("option");
    option.value = model.name;
    option.textContent = model.name;
    select.append(option);
  }
  select.value = state.config?.defaultModel || state.models[0]?.name || "";
}

function renderLogs() {
  const query = $("#log-filter").value.trim().toLowerCase();
  const rows = state.logs.filter((entry) => !query || entry.message.toLowerCase().includes(query) || entry.stream.includes(query));
  $("#log-output").textContent = rows.length
    ? rows.map((entry) => `[${entry.time.slice(11, 19)}] ${entry.stream}: ${entry.message}`).join("\n")
    : t("noLogs");
}

function renderRuntime() {
  const runtime = state.runtime;
  if (!runtime) return;
  $("#runtime-installed").textContent = runtime.installed ? runtime.currentVersion || t("yes") : t("no");
  $("#runtime-latest").textContent = runtime.latestRelease?.tagName || runtime.releaseError || "-";
  $("#runtime-update").textContent = runtime.updateAvailable ? t("yes") : t("no");
  $("#runtime-path").textContent = runtime.managedPath || "-";
  $("#runtime-asset").textContent = runtime.latestRelease?.asset?.name || runtime.installedAssetName || "-";
  $("#runtime-checksum").textContent = runtime.installedDigest || runtime.latestRelease?.asset?.digest || "-";
  $("#runtime-update-btn").disabled = !runtime.installed;
  $("#runtime-rollback").disabled = !runtime.canRollback;
  $("#runtime-uninstall").disabled = !runtime.canUninstall;

  const backups = $("#runtime-backups");
  backups.textContent = "";
  if (!runtime.backups?.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.style.padding = "16px";
    empty.textContent = t("noBackups");
    backups.append(empty);
    return;
  }
  for (const backup of runtime.backups) {
    const row = document.createElement("div");
    row.className = "backup-row";
    const version = document.createElement("strong");
    version.textContent = backup.version || "-";
    const file = document.createElement("code");
    file.textContent = backup.path;
    const button = document.createElement("button");
    button.className = "secondary";
    button.dataset.rollbackPath = backup.path;
    button.textContent = t("rollback");
    row.append(version, file, button);
    backups.append(row);
  }
}

function renderI18n() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((node) => node.classList.toggle("active", node.id === tab));
  document.querySelectorAll(".nav button").forEach((node) => node.classList.toggle("active", node.dataset.tab === tab));
}

async function refreshStatus() {
  state.status = await api("/api/app/status");
  renderStatus();
}

async function refreshModels() {
  try {
    state.models = (await api("/api/shimmy/models")).models || [];
  } catch {
    state.models = [];
  }
  renderModels();
}

async function refreshLogs() {
  state.logs = (await api("/api/shimmy/logs")).logs || [];
  renderLogs();
}

async function refreshRuntime() {
  state.runtime = await api("/api/runtime/status");
  renderRuntime();
}

async function refreshAll() {
  await refreshStatus();
  await refreshModels();
  await refreshLogs();
  await refreshRuntime();
}

async function runtimePost(path, body) {
  await api(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  await refreshStatus();
  await refreshRuntime();
}

async function sendChat() {
  const output = $("#chat-output");
  output.textContent = "";
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: $("#chat-model").value,
      stream: true,
      messages: [{ role: "user", content: $("#prompt").value }],
      temperature: Number($("#temperature").value),
      top_p: Number($("#top-p").value),
      max_tokens: Number($("#max-tokens").value),
    }),
  });
  if (!response.ok || !response.body) {
    output.textContent = `${response.status} ${response.statusText}`;
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split("\n")) {
      const clean = line.replace(/^data:\s*/, "").trim();
      if (!clean || clean === "[DONE]") continue;
      try {
        const parsed = JSON.parse(clean);
        output.textContent += parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || "";
      } catch {
        output.textContent += clean;
      }
    }
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.tab) switchTab(target.dataset.tab);
  if (target.id === "refresh-btn") await refreshAll();
  if (target.id === "runtime-refresh") await refreshRuntime();
  if (target.id === "runtime-download") await runtimePost("/api/runtime/download");
  if (target.id === "runtime-install") await runtimePost("/api/runtime/install", { useExistingDownload: true });
  if (target.id === "runtime-update-btn") await runtimePost("/api/runtime/update");
  if (target.id === "runtime-rollback") await runtimePost("/api/runtime/rollback");
  if (target.id === "runtime-uninstall") await runtimePost("/api/runtime/uninstall");
  if (target.dataset.rollbackPath) await runtimePost("/api/runtime/rollback", { backupPath: target.dataset.rollbackPath });
  if (target.id === "start-btn") {
    await api("/api/shimmy/start", { method: "POST" });
    await refreshAll();
  }
  if (target.id === "stop-btn") {
    await api("/api/shimmy/stop", { method: "POST" });
    await refreshAll();
  }
  if (target.id === "discover-btn") {
    await api("/api/shimmy/discover", { method: "POST" }).catch(() => {});
    await refreshModels();
  }
  if (target.id === "save-btn") {
    state.config = (await api("/api/app/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(configFromForm()),
    })).config;
    renderStatus();
  }
  if (target.id === "send-btn") await sendChat();
  if (target.id === "clear-logs") {
    await fetch("/api/shimmy/logs", { method: "DELETE" });
    await refreshLogs();
  }
  if (target.id === "copy-logs") await navigator.clipboard?.writeText($("#log-output").textContent);
  if (target.dataset.chat) {
    $("#chat-model").value = target.dataset.chat;
    switchTab("chat");
  }
  if (target.dataset.probe) {
    const result = await api("/api/shimmy/probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: target.dataset.probe }),
    });
    $("#chat-output").textContent = result.output || "";
    $("#chat-model").value = target.dataset.probe;
    switchTab("chat");
  }
  if (target.dataset.default) {
    state.config = {
      ...state.config,
      defaultModel: target.dataset.default,
    };
    await api("/api/app/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state.config),
    });
    await refreshStatus();
    renderModels();
  }
});

$("#log-filter").addEventListener("input", renderLogs);
setInterval(refreshStatus, 5000);
setInterval(refreshLogs, 2000);
await refreshAll();
