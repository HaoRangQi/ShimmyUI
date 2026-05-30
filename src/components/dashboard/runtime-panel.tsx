import { Download, RotateCcw, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { Button, LinearProgress, Panel } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";

interface RuntimeStatus {
  managedPath: string;
  installed: boolean;
  installedByUi: boolean;
  currentVersion?: string | null;
  installedVersion?: string | null;
  installedDigest?: string | null;
  installedAssetName?: string | null;
  installedAt?: string | null;
  latestRelease?: {
    tagName: string;
    htmlUrl?: string;
    asset: {
      name: string;
      size?: number;
      digest?: string | null;
      downloadUrl: string;
    };
  } | null;
  releaseError?: string | null;
  updateAvailable: boolean;
  downloads: Array<{
    version: string;
    assetName: string;
    digest: string;
    path: string;
    downloadedAt: string;
  }>;
  backups: Array<{
    version: string | null;
    digest: string | null;
    path: string;
    createdAt: string;
  }>;
  canUninstall: boolean;
  canRollback: boolean;
}

interface RuntimePanelProps {
  t: Dictionary;
  runtime?: RuntimeStatus;
  busy: boolean;
  activeAction?: RuntimeAction | null;
  refresh: () => void;
  download: () => void;
  install: () => void;
  update: () => void;
  confirmUninstall: () => void;
  confirmRollback: (backupPath?: string) => void;
}

type RuntimeAction = "download" | "install" | "update" | "uninstall" | "rollback";

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-3xl bg-[rgb(var(--panel-2))] p-4">
      <div className="text-xs font-semibold tracking-normal text-[rgb(var(--muted))]">
        {label}
      </div>
      <div className="mt-1 min-w-0 break-words text-sm font-medium">{value || "-"}</div>
    </div>
  );
}

function CopyableValue({ value, copyLabel }: { value?: string | null; copyLabel: string }) {
  if (!value) return <>-</>;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 flex-1 truncate" title={value}>
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        className="h-8 shrink-0 px-3"
        onClick={() => void navigator.clipboard?.writeText(value)}
      >
        {copyLabel}
      </Button>
    </span>
  );
}

function runtimeActionLabel(action: RuntimeAction | null | undefined, t: Dictionary) {
  if (action === "download") return t.download;
  if (action === "install") return t.install;
  if (action === "update") return t.update;
  if (action === "uninstall") return t.uninstall;
  if (action === "rollback") return t.rollback;
  return t.operationRunning;
}

export function RuntimePanel({
  t,
  runtime,
  busy,
  activeAction,
  refresh,
  download,
  install,
  update,
  confirmUninstall,
  confirmRollback,
}: RuntimePanelProps) {
  const latest = runtime?.latestRelease;
  const latestDigest = latest?.asset.digest ?? runtime?.releaseError ?? "-";

  return (
    <div className="grid gap-5">
      <Panel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{t.runtime}</h2>
            <p className="mt-1 max-w-2xl text-sm text-[rgb(var(--muted))]">
              {t.runtimeHint}
            </p>
          </div>
          <Button variant="secondary" onClick={refresh} disabled={busy}>
            <ShieldCheck size={15} />
            {t.refresh}
          </Button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Detail
            label={t.installed}
            value={runtime?.installed ? runtime.currentVersion || t.yes : t.no}
          />
          <Detail label={t.latest} value={latest?.tagName ?? runtime?.releaseError ?? "-"} />
          <Detail
            label={t.updateAvailable}
            value={runtime?.updateAvailable ? t.yes : t.no}
          />
          <Detail label={t.asset} value={latest?.asset.name ?? runtime?.installedAssetName ?? "-"} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Detail label={t.managedPath} value={<CopyableValue value={runtime?.managedPath} copyLabel={t.copy} />} />
          <Detail label={t.checksum} value={<CopyableValue value={runtime?.installedDigest ?? latestDigest} copyLabel={t.copy} />} />
        </div>

        {busy ? (
          <div className="mt-5">
            <LinearProgress label={t.operationRunning} />
            <div className="mt-2 text-xs font-semibold text-[rgb(var(--muted))]">
              {runtimeActionLabel(activeAction, t)}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={download} disabled={busy}>
            <Download size={15} />
            {activeAction === "download" ? t.operationRunning : t.download}
          </Button>
          <Button variant="secondary" onClick={install} disabled={busy}>
            <UploadCloud size={15} />
            {activeAction === "install" ? t.operationRunning : t.install}
          </Button>
          <Button
            variant="secondary"
            onClick={update}
            disabled={busy || !runtime?.installed || !runtime?.updateAvailable}
          >
            <UploadCloud size={15} />
            {activeAction === "update" ? t.operationRunning : t.update}
          </Button>
          <Button
            variant="secondary"
            onClick={() => confirmRollback()}
            disabled={busy || !runtime?.canRollback}
          >
            <RotateCcw size={15} />
            {activeAction === "rollback" ? t.operationRunning : t.rollback}
          </Button>
          <Button
            variant="danger"
            onClick={confirmUninstall}
            disabled={busy || !runtime?.canUninstall}
          >
            <Trash2 size={15} />
            {activeAction === "uninstall" ? t.operationRunning : t.uninstall}
          </Button>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-[rgb(var(--line))]/60 p-5">
          <h3 className="text-xl font-semibold">{t.backups}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-[rgb(var(--surface-container-high))] text-xs font-semibold tracking-normal text-[rgb(var(--muted))]">
              <tr>
                <th className="px-4 py-3">{t.version}</th>
                <th className="px-4 py-3">{t.checksum}</th>
                <th className="px-4 py-3">{t.path}</th>
                <th className="px-4 py-3">{t.action}</th>
              </tr>
            </thead>
            <tbody>
              {(runtime?.backups ?? []).map((backup) => (
                <tr key={backup.path} className="transition hover:bg-[rgb(var(--surface-container-high))]/70">
                  <td className="border-t border-[rgb(var(--line))]/60 px-4 py-3">{backup.version ?? "-"}</td>
                  <td className="max-w-xs break-words border-t border-[rgb(var(--line))]/60 px-4 py-3 text-[rgb(var(--muted))]">
                    {backup.digest ?? "-"}
                  </td>
                  <td className="max-w-sm break-words border-t border-[rgb(var(--line))]/60 px-4 py-3">{backup.path}</td>
                  <td className="border-t border-[rgb(var(--line))]/60 px-4 py-3">
                    <Button
                      variant="ghost"
                      onClick={() => confirmRollback(backup.path)}
                      disabled={busy}
                    >
                      {t.rollback}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(runtime?.backups ?? []).length === 0 ? (
            <p className="p-6 text-sm text-[rgb(var(--muted))]">{t.noBackups}</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

export type { RuntimeStatus };
