import { CheckCircle2, Cpu, Database, Gauge, HardDrive, RefreshCcw, XCircle } from "lucide-react";
import { Button, Panel, StatusPill } from "@/components/ui";
import type { DashboardTab } from "./types";
import type { AppStatus, ServiceState, ShimmyModel } from "@/lib/shimmy/types";
import type { Dictionary } from "@/lib/i18n";
import { serviceLabel } from "./utils";

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgb(var(--primary-container))] text-[rgb(var(--on-primary-container))]">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-normal text-[rgb(var(--muted))]">
            {label}
          </div>
          <div className="truncate text-2xl font-semibold">{value}</div>
        </div>
      </div>
    </Panel>
  );
}

interface OverviewPanelProps {
  t: Dictionary;
  status?: AppStatus;
  statusState: ServiceState;
  modelRows: ShimmyModel[];
  endpoint: string;
  refreshAll: () => void;
  setTab: (tab: DashboardTab) => void;
  runSmokeTest: () => void;
}

export function OverviewPanel({
  t,
  status,
  statusState,
  modelRows,
  endpoint,
  refreshAll,
  setTab,
  runSmokeTest,
}: OverviewPanelProps) {
  const setupItems = createSetupItems({
    t,
    status,
    statusState,
    modelRows,
      setTab,
      runSmokeTest,
  });
  const nextItem = setupItems.find((item) => !item.done);
  const modelDirHealth = status?.modelDirsHealth;

  return (
    <div className="grid gap-5">
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{t.setupTitle}</h2>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              {nextItem ? `${t.setupNext}: ${nextItem.label}` : t.setupDone}
            </p>
          </div>
          {nextItem ? (
            <Button onClick={nextItem.action}>
              {nextItem.actionLabel}
            </Button>
          ) : (
            <StatusPill state="ok" label={t.setupDone} />
          )}
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-5">
          {setupItems.map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-3xl bg-[rgb(var(--panel-2))] p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    item.done ? "text-[rgb(var(--success))]" : "text-[rgb(var(--warn))]"
                  }
                >
                  {item.done ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                </span>
                <div className="min-w-0 text-sm font-semibold">{item.label}</div>
              </div>
              <p className="mt-2 text-xs leading-5 text-[rgb(var(--muted))]">{item.hint}</p>
              {!item.done ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 h-8 px-3"
                  onClick={item.action}
                >
                  {item.actionLabel}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={<Gauge size={18} />}
          label={t.service}
          value={serviceLabel(statusState, t)}
        />
        <Stat
          icon={<Cpu size={18} />}
          label={t.gpu}
          value={
            status?.metrics.gpuVendor ??
            (status?.metrics.gpuDetected ? "detected" : "-")
          }
        />
        <Stat
          icon={<Database size={18} />}
          label={t.modelCount}
          value={status?.health.modelsTotal ?? modelRows.length ?? "-"}
        />
        <Stat
          icon={<HardDrive size={18} />}
          label={t.memory}
          value={
            status?.metrics.memoryAvailableMb
              ? `${status.metrics.memoryAvailableMb} MB`
              : "-"
          }
        />
      </div>

      <Panel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{t.overview}</h2>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">{endpoint}</p>
          </div>
          <Button variant="secondary" onClick={refreshAll}>
            <RefreshCcw size={15} />
            {t.refresh}
          </Button>
        </div>
        <dl className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl bg-[rgb(var(--panel-2))] p-4">
            <dt className="text-xs font-semibold tracking-normal text-[rgb(var(--muted))]">
              {t.binary}
            </dt>
            <dd className="mt-1 truncate text-sm">
              {status?.binary?.path ?? t.notFound}
            </dd>
          </div>
          <div className="rounded-3xl bg-[rgb(var(--panel-2))] p-4">
            <dt className="text-xs font-semibold tracking-normal text-[rgb(var(--muted))]">
              {t.managedPid}
            </dt>
            <dd className="mt-1 text-sm">{status?.managedPid ?? "-"}</dd>
          </div>
          <div className="rounded-3xl bg-[rgb(var(--panel-2))] p-4 md:col-span-2">
            <dt className="text-xs font-semibold tracking-normal text-[rgb(var(--muted))]">
              {t.modelDirHealth}
            </dt>
            <dd className="mt-1 text-sm">
              {modelDirHealth?.hasModels
                ? `${t.modelDirsReady} ${modelDirHealth.totalGgufFiles}`
                : modelDirHealth?.hasReadableDirectory
                  ? t.modelDirsMissingGguf
                  : t.modelDirsNotConfigured}
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

function createSetupItems({
  t,
  status,
  statusState,
  modelRows,
  setTab,
  runSmokeTest,
}: {
  t: Dictionary;
  status?: AppStatus;
  statusState: ServiceState;
  modelRows: ShimmyModel[];
  setTab: (tab: DashboardTab) => void;
  runSmokeTest: () => void;
}) {
  const hasBinary = Boolean(status?.binary?.executable);
  const hasModelDir = Boolean(status?.modelDirsHealth.hasReadableDirectory);
  const hasDiscoveredModel = modelRows.length > 0 || Boolean(status?.health.modelsTotal);
  const isRunning = statusState === "running-managed" || statusState === "running-external";
  const canSmokeChat = isRunning && hasDiscoveredModel;

  return [
    {
      label: t.setupInstallShimmy,
      hint: t.setupInstallShimmyHint,
      done: hasBinary,
      actionLabel: t.goRuntime,
      action: () => setTab("runtime"),
    },
    {
      label: t.setupModelDirs,
      hint: t.setupModelDirsHint,
      done: hasModelDir,
      actionLabel: t.goConfig,
      action: () => setTab("config"),
    },
    {
      label: t.setupDiscoverModels,
      hint: t.setupDiscoverModelsHint,
      done: hasDiscoveredModel,
      actionLabel: t.goModels,
      action: () => setTab("models"),
    },
    {
      label: t.setupStartService,
      hint: t.setupStartServiceHint,
      done: isRunning,
      actionLabel: t.goRuntime,
      action: () => setTab("runtime"),
    },
    {
      label: t.setupSmokeChat,
      hint: t.setupSmokeChatHint,
      done: canSmokeChat,
      actionLabel: canSmokeChat ? t.runSmokeTest : t.goChat,
      action: canSmokeChat ? runSmokeTest : () => setTab("chat"),
    },
  ];
}
