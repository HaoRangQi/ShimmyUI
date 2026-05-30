import { Clipboard, RefreshCcw } from "lucide-react";
import { Button, Panel, StatusPill } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { AppStatus, ShimmyModel } from "@/lib/shimmy/types";
import type { RuntimeStatus } from "./runtime-panel";

interface DiagnosticsPanelProps {
  t: Dictionary;
  status?: AppStatus;
  runtime?: RuntimeStatus;
  modelRows: ShimmyModel[];
  endpoint: string;
  gpuInfo?: string;
  refresh: () => void;
}

export function DiagnosticsPanel({
  t,
  status,
  runtime,
  modelRows,
  endpoint,
  gpuInfo,
  refresh,
}: DiagnosticsPanelProps) {
  const report = buildDiagnosticsReport({ status, runtime, modelRows, endpoint, gpuInfo });

  return (
    <div className="grid min-w-0 gap-5">
      <Panel className="min-w-0 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{t.diagnostics}</h2>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">{endpoint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={refresh}>
              <RefreshCcw size={15} />
              {t.refresh}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void navigator.clipboard?.writeText(report)}
            >
              <Clipboard size={15} />
              {t.copyReport}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DiagnosticCard
            title={t.health}
            value={status?.health.ok ? "ok" : status?.health.error ?? "-"}
            tone={status?.health.ok ? "ok" : "error"}
          />
          <DiagnosticCard
            title={t.metrics}
            value={status?.metrics.ok ? t.yes : status?.metrics.error ?? "-"}
            tone={status?.metrics.ok ? "ok" : "warn"}
          />
          <DiagnosticCard
            title={t.modelDirHealth}
            value={
              status?.modelDirsHealth.hasModels
                ? `${status.modelDirsHealth.totalGgufFiles} GGUF`
                : t.modelDirsMissingGguf
            }
            tone={status?.modelDirsHealth.hasModels ? "ok" : "warn"}
          />
          <DiagnosticCard
            title={t.runtime}
            value={runtime?.installed ? runtime.currentVersion ?? t.yes : t.no}
            tone={runtime?.installed ? "ok" : "warn"}
          />
        </div>
      </Panel>

      <Panel className="min-w-0 p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">{t.diagnosticsReport}</h3>
          <StatusPill state={status?.state === "error" ? "error" : "idle"} label={status?.state ?? "-"} />
        </div>
        <pre className="max-h-[60vh] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-[24px] bg-[rgb(var(--surface-container-high))] p-4 text-xs leading-5 text-[rgb(var(--text))]">
          {report}
        </pre>
      </Panel>
    </div>
  );
}

function DiagnosticCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "ok" | "warn" | "error" | "idle";
}) {
  return (
    <div className="min-w-0 rounded-3xl bg-[rgb(var(--panel-2))] p-4">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <StatusPill state={tone} label={value} />
    </div>
  );
}

function buildDiagnosticsReport({
  status,
  runtime,
  modelRows,
  endpoint,
  gpuInfo,
}: Omit<DiagnosticsPanelProps, "t" | "refresh">) {
  const lines = [
    "Shimmy UI diagnostics",
    `endpoint=${endpoint}`,
    `service_state=${status?.state ?? "unknown"}`,
    `binary=${status?.binary?.path ?? "missing"}`,
    `managed_pid=${status?.managedPid ?? "-"}`,
    `health_ok=${status?.health.ok ?? false}`,
    `health_error=${status?.health.error ?? "-"}`,
    `metrics_ok=${status?.metrics.ok ?? false}`,
    `gpu_detected=${status?.metrics.gpuDetected ?? false}`,
    `gpu_vendor=${status?.metrics.gpuVendor ?? "-"}`,
    `memory_available_mb=${status?.metrics.memoryAvailableMb ?? "-"}`,
    `model_dirs_configured=${status?.modelDirsHealth.configured ?? false}`,
    `model_dirs_readable=${status?.modelDirsHealth.hasReadableDirectory ?? false}`,
    `model_dirs_gguf=${status?.modelDirsHealth.totalGgufFiles ?? 0}`,
    `models_loaded=${modelRows.length}`,
    `runtime_installed=${runtime?.installed ?? false}`,
    `runtime_version=${runtime?.currentVersion ?? "-"}`,
    `runtime_release_error=${runtime?.releaseError ?? "-"}`,
    "",
    "gpu-info:",
    gpuInfo || "-",
  ];

  return lines.join("\n");
}
