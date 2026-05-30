import { Download, Play, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { Button, Field, inputClass, Panel, StatusPill } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { ModelDirectoriesHealth, ShimmyModel } from "@/lib/shimmy/types";
import type {
  CatalogModel,
  DiscoverSummary,
  HuggingFaceModel,
  HuggingFaceModelFile,
  HuggingFaceSearchSort,
  ManagedModel,
  ModelDownloadJob,
  OllamaCatalogModel,
  OllamaModel,
  OllamaStatus,
} from "./types";
import { bytesToSize } from "./utils";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

interface ModelsPanelProps {
  t: Dictionary;
  modelRows: ShimmyModel[];
  defaultModel?: string;
  catalogModels: CatalogModel[];
  huggingFaceModels: HuggingFaceModel[];
  huggingFaceFilesByRepo: Record<string, HuggingFaceModelFile[]>;
  huggingFaceSort: HuggingFaceSearchSort;
  managedModels: ManagedModel[];
  ollamaStatus?: OllamaStatus;
  ollamaModels: OllamaModel[];
  ollamaCatalogModels: OllamaCatalogModel[];
  localGgufPath: string;
  catalogQuery: string;
  ollamaQuery: string;
  ollamaModelName: string;
  editingManagedModel?: string | null;
  managedModelNameDraft: string;
  modelLibraryPending: boolean;
  huggingFaceLoading: boolean;
  huggingFaceFilesLoadingRepoId?: string | null;
  huggingFaceDownloadJobsByKey: Record<string, ModelDownloadJob>;
  huggingFacePending: boolean;
  ollamaPending: boolean;
  modelDirsHealth?: ModelDirectoriesHealth;
  discoverPending: boolean;
  discoverSummary?: DiscoverSummary | null;
  discover: () => void;
  setLocalGgufPath: (path: string) => void;
  setCatalogQuery: (query: string) => void;
  setHuggingFaceSort: (sort: HuggingFaceSearchSort) => void;
  setOllamaQuery: (query: string) => void;
  setOllamaModelName: (name: string) => void;
  setEditingManagedModel: (name: string | null) => void;
  setManagedModelNameDraft: (name: string) => void;
  importLocalGguf: () => void;
  downloadCatalogModel: (modelId: string) => void;
  loadHuggingFaceFiles: (repoId: string) => void;
  downloadHuggingFaceFile: (repoId: string, fileName: string) => void;
  deleteManagedModel: (modelName: string) => void;
  renameManagedModel: (modelName: string, nextName: string) => void;
  startOllama: () => void;
  pullOllamaModel: (modelName: string) => void;
  deleteOllamaModel: (modelName: string) => void;
  openChat: (modelName: string) => void;
  probe: (modelName: string) => void;
  setDefaultModel: (modelName: string) => void;
}

export function ModelsPanel({
  t,
  modelRows,
  defaultModel,
  catalogModels,
  huggingFaceModels,
  huggingFaceFilesByRepo,
  huggingFaceSort,
  managedModels,
  ollamaStatus,
  ollamaModels,
  ollamaCatalogModels,
  localGgufPath,
  catalogQuery,
  ollamaQuery,
  ollamaModelName,
  editingManagedModel,
  managedModelNameDraft,
  modelLibraryPending,
  huggingFaceLoading,
  huggingFaceFilesLoadingRepoId,
  huggingFaceDownloadJobsByKey,
  huggingFacePending,
  ollamaPending,
  modelDirsHealth,
  discoverPending,
  discoverSummary,
  discover,
  setLocalGgufPath,
  setCatalogQuery,
  setHuggingFaceSort,
  setOllamaQuery,
  setOllamaModelName,
  setEditingManagedModel,
  setManagedModelNameDraft,
  importLocalGguf,
  downloadCatalogModel,
  loadHuggingFaceFiles,
  downloadHuggingFaceFile,
  deleteManagedModel,
  renameManagedModel,
  startOllama,
  pullOllamaModel,
  deleteOllamaModel,
  openChat,
  probe,
  setDefaultModel,
}: ModelsPanelProps) {
  return (
    <div className="grid gap-5">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--line))]/60 p-5">
          <h2 className="text-2xl font-semibold">{t.models}</h2>
          <Button variant="secondary" onClick={discover} disabled={discoverPending}>
            <RefreshCcw size={15} />
            {discoverPending ? t.operationRunning : t.discover}
          </Button>
        </div>
        <div className="grid gap-3 border-b border-[rgb(var(--line))]/60 p-5 md:grid-cols-2">
          <div className="rounded-3xl bg-[rgb(var(--panel-2))] p-4">
            <div className="mb-2 text-sm font-semibold">{t.modelDirHealth}</div>
            <StatusPill
              state={modelDirsHealth?.hasModels ? "ok" : modelDirsHealth?.hasReadableDirectory ? "warn" : "error"}
              label={
                modelDirsHealth?.hasModels
                  ? `${t.modelDirsReady} ${modelDirsHealth.totalGgufFiles}`
                  : modelDirsHealth?.hasReadableDirectory
                    ? t.modelDirsMissingGguf
                    : t.modelDirsNotConfigured
              }
            />
          </div>
          <div className="rounded-3xl bg-[rgb(var(--panel-2))] p-4">
            <div className="mb-2 text-sm font-semibold">{t.discoverSummary}</div>
            {discoverSummary ? (
              <div className="text-sm text-[rgb(var(--muted))]">
                {discoverSummary.error ? (
                  discoverSummary.error
                ) : (
                  `${t.discoveredModels}: ${discoverSummary.modelsFound} · ${t.elapsedMs}: ${discoverSummary.elapsedMs}ms`
                )}
              </div>
            ) : (
              <div className="text-sm text-[rgb(var(--muted))]">-</div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-[rgb(var(--surface-container-high))] text-xs font-semibold tracking-normal text-[rgb(var(--muted))]">
              <tr>
                <th className="px-4 py-3">{t.model}</th>
                <th className="px-4 py-3">{t.source}</th>
                <th className="px-4 py-3">{t.size}</th>
                <th className="px-4 py-3">{t.type}</th>
                <th className="px-4 py-3">{t.params}</th>
                <th className="px-4 py-3">{t.action}</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.map((model) => (
                <tr
                  key={`${model.source}-${model.name}`}
                  className="transition hover:bg-[rgb(var(--surface-container-high))]/70"
                >
                  <td className="border-t border-[rgb(var(--line))]/60 px-4 py-3 font-semibold">{model.name}</td>
                  <td className="border-t border-[rgb(var(--line))]/60 px-4 py-3 text-[rgb(var(--muted))]">
                    {model.source}
                  </td>
                  <td className="border-t border-[rgb(var(--line))]/60 px-4 py-3">{bytesToSize(model.sizeBytes)}</td>
                  <td className="border-t border-[rgb(var(--line))]/60 px-4 py-3">{model.modelType ?? "-"}</td>
                  <td className="border-t border-[rgb(var(--line))]/60 px-4 py-3">{model.parameterCount ?? "-"}</td>
                  <td className="flex gap-2 border-t border-[rgb(var(--line))]/60 px-4 py-3">
                    <Button variant="secondary" onClick={() => openChat(model.name)}>
                      {t.chat}
                    </Button>
                    <Button variant="ghost" onClick={() => probe(model.name)}>
                      {t.probe}
                    </Button>
                    <Button variant="ghost" onClick={() => setDefaultModel(model.name)}>
                      {defaultModel === model.name ? t.defaultModel : t.setDefault}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {modelRows.length === 0 ? (
            <p className="p-8 text-sm text-[rgb(var(--muted))]">{t.noModels}</p>
          ) : null}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-[rgb(var(--line))]/60 p-5">
          <h2 className="text-2xl font-semibold">{t.modelLibrary}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[rgb(var(--muted))]">
            {t.catalogDownloadAdvice}
          </p>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[1.5fr_1fr]">
          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{t.huggingFaceModels}</h3>
              <StatusPill state="ok" label="GGUF" />
            </div>
            <p className="mb-3 text-sm leading-6 text-[rgb(var(--muted))]">
              {t.huggingFaceSearchAdvice}
            </p>
            <Field label={t.searchGgufModels}>
              <input
                className={inputClass}
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </Field>
            <div className="mb-3 mt-3 grid gap-3 sm:max-w-xs">
              <Field label={t.huggingFaceSort}>
                <select
                  className={inputClass}
                  value={huggingFaceSort}
                  onChange={(event) =>
                    setHuggingFaceSort(event.target.value as HuggingFaceSearchSort)
                  }
                >
                  <option value="downloads">{t.huggingFaceSortDownloads}</option>
                  <option value="trending">{t.huggingFaceSortTrending}</option>
                  <option value="updated">{t.huggingFaceSortUpdated}</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3">
              {huggingFaceLoading ? (
                <p className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4 text-sm text-[rgb(var(--muted))]">
                  {t.operationRunning}
                </p>
              ) : null}
              {huggingFaceModels.map((repo) => {
                const loadedFiles = huggingFaceFilesByRepo[repo.repoId] ?? [];
                const hasLoadedFiles = Object.prototype.hasOwnProperty.call(
                  huggingFaceFilesByRepo,
                  repo.repoId,
                );
                const activeDownloadJobs = Object.entries(huggingFaceDownloadJobsByKey)
                  .filter(([key, job]) => key.startsWith(`${repo.repoId}:`) && !job.done)
                  .map(([key, job]) => ({
                    key,
                    fileName: key.slice(`${repo.repoId}:`.length),
                    job,
                  }));
                return (
                  <article
                    key={repo.repoId}
                    className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words text-base font-semibold">{repo.repoId}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[rgb(var(--muted))]">
                          <span>{t.huggingFaceDownloads}: {(repo.downloads ?? 0).toLocaleString()}</span>
                          <span>{t.huggingFaceLastUpdated}: {formatDate(repo.lastModified)}</span>
                          <span>likes: {(repo.likes ?? 0).toLocaleString()}</span>
                          {repo.ggufFileCount ? <span>GGUF: {repo.ggufFileCount}</span> : null}
                        </div>
                      </div>
                      <StatusPill
                        state="idle"
                        label={repo.tags.includes("gguf") ? "GGUF" : t.notInstalled}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => loadHuggingFaceFiles(repo.repoId)}
                        disabled={
                          modelLibraryPending ||
                          huggingFacePending ||
                          huggingFaceFilesLoadingRepoId === repo.repoId
                        }
                      >
                        <RefreshCcw size={15} />
                        {huggingFaceFilesLoadingRepoId === repo.repoId
                          ? t.operationRunning
                          : t.huggingFaceLoadFiles}
                      </Button>
                    </div>
                    {activeDownloadJobs.length > 0 ? (
                      <div className="mt-4 grid gap-2">
                        {activeDownloadJobs.map(({ key, fileName, job }) => {
                          const percent =
                            job.totalBytes && job.totalBytes > 0
                              ? Math.min(100, Math.round((job.downloadedBytes / job.totalBytes) * 100))
                              : undefined;
                          const etaSeconds = estimateEtaSeconds(job);
                          return (
                            <div
                              key={`active-${key}`}
                              className="rounded-2xl border border-[rgb(var(--line))]/60 bg-[rgb(var(--surface-container-high))] p-3 text-sm"
                            >
                              <div className="mb-1 text-xs font-semibold text-[rgb(var(--muted))]">
                                {t.operationRunning}
                              </div>
                              <div className="truncate font-semibold" title={fileName}>
                                {fileName}
                              </div>
                              <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                                {downloadPhaseLabel(job.phase, t)}
                                {typeof percent === "number" ? ` · ${percent}%` : ""}
                              </div>
                              {typeof percent === "number" ? (
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--line))]/50">
                                  <div
                                    className="h-full rounded-full bg-[rgb(var(--primary))]"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              ) : null}
                              <div className="mt-2 text-xs text-[rgb(var(--muted))]">
                                {t.downloadedBytesLabel}: {bytesToSize(job.downloadedBytes)}
                                {job.totalBytes ? ` / ${bytesToSize(job.totalBytes)}` : ""}
                              </div>
                              <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                                {t.etaLabel}:{" "}
                                {typeof etaSeconds === "number" ? formatDuration(etaSeconds) : t.etaUnknown}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {loadedFiles.length > 0 ? (
                      <div className="mt-4 grid gap-2">
                        <div className="text-sm font-semibold">{t.huggingFaceFiles}</div>
                        {loadedFiles.map((file) => {
                          const installed = managedModels.some(
                            (item) =>
                              item.huggingFaceRepoId === repo.repoId &&
                              item.huggingFaceFile === file.name,
                          );
                          const downloadKey = `${repo.repoId}:${file.name}`;
                          const downloadJob = huggingFaceDownloadJobsByKey[downloadKey];
                          const running = Boolean(downloadJob && !downloadJob.done);
                          const failed = Boolean(downloadJob?.done && downloadJob.error);
                          return (
                            <div
                              key={downloadKey}
                              className="rounded-2xl bg-[rgb(var(--surface-container-high))] p-3 text-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate font-semibold" title={file.name}>
                                    {file.name}
                                  </div>
                                  <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                                    {[file.quantization ?? "-", bytesToSize(file.sizeBytes)]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                  {downloadJob && downloadJob.done ? (
                                    <div className="mt-2 grid gap-1 text-xs text-[rgb(var(--muted))]">
                                      <div>
                                        {failed
                                          ? `${t.operationFailed} · ${downloadJob.error ?? "-"}`
                                          : `${t.modelDownloadComplete}`}
                                      </div>
                                      <div>
                                        {t.downloadedBytesLabel}: {bytesToSize(downloadJob.downloadedBytes)}
                                        {downloadJob.totalBytes
                                          ? ` / ${bytesToSize(downloadJob.totalBytes)}`
                                          : ""}
                                      </div>
                                      {!failed ? (
                                        <div>
                                          {t.etaLabel}: {t.etaDone}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                                <Button
                                  className="h-9 px-3"
                                  onClick={() => downloadHuggingFaceFile(repo.repoId, file.name)}
                                  disabled={modelLibraryPending || huggingFacePending || installed || running}
                                >
                                  <Download size={14} />
                                  {installed
                                    ? t.installedModel
                                    : running || activeDownloadJobs.some((item) => item.fileName === file.name)
                                      ? t.operationRunning
                                      : t.huggingFaceDownloadFile}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {hasLoadedFiles && loadedFiles.length === 0 ? (
                      <p className="mt-3 text-sm text-[rgb(var(--muted))]">{t.huggingFaceNoFiles}</p>
                    ) : null}
                  </article>
                );
              })}
              {!huggingFaceLoading && huggingFaceModels.length === 0 ? (
                <p className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4 text-sm text-[rgb(var(--muted))]">
                  {t.huggingFaceNoResults}
                </p>
              ) : null}
              {catalogModels.length > 0 ? (
                <div className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4">
                  <div className="mb-3 text-sm font-semibold">{t.curatedModels}</div>
                  <div className="grid gap-2">
                    {catalogModels.map((model) => {
                      const installed = managedModels.some((item) => item.catalogId === model.id);
                      return (
                        <div
                          key={model.id}
                          className="rounded-2xl bg-[rgb(var(--surface-container-high))] p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold">{model.name}</div>
                              <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                                {model.quantization} · {bytesToSize(model.sizeBytes)}
                              </div>
                            </div>
                            <Button
                              onClick={() => downloadCatalogModel(model.id)}
                              disabled={modelLibraryPending || installed}
                            >
                              <Download size={14} />
                              {installed ? t.installedModel : t.downloadAndVerify}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid min-w-0 gap-4">
            <div className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4">
              <h3 className="text-lg font-semibold">{t.managedModelList}</h3>
              <div className="mt-4 grid gap-2">
                {managedModels.map((model) => (
                  <div
                    key={model.path}
                    className="rounded-2xl bg-[rgb(var(--surface-container-high))] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="break-words font-semibold">{model.name}</div>
                        <div className="mt-1 break-words text-xs text-[rgb(var(--muted))]">
                          {model.source} · {bytesToSize(model.sizeBytes)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="h-9 px-3"
                          onClick={() => {
                            setEditingManagedModel(model.name);
                            setManagedModelNameDraft(model.name);
                          }}
                          disabled={modelLibraryPending}
                        >
                          {t.renameModel}
                        </Button>
                        <Button
                          variant="danger"
                          className="h-9 px-3"
                          onClick={() => deleteManagedModel(model.name)}
                          disabled={modelLibraryPending}
                        >
                          <Trash2 size={14} />
                          {t.deleteModel}
                        </Button>
                      </div>
                    </div>
                    {editingManagedModel === model.name ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          className={inputClass}
                          value={managedModelNameDraft}
                          onChange={(event) => setManagedModelNameDraft(event.target.value)}
                        />
                        <Button
                          onClick={() => renameManagedModel(model.name, managedModelNameDraft)}
                          disabled={modelLibraryPending || !managedModelNameDraft.trim()}
                        >
                          {t.save}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {managedModels.length === 0 ? (
                  <div className="text-sm text-[rgb(var(--muted))]">{t.noManagedModels}</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4">
              <h3 className="text-lg font-semibold">{t.localImport}</h3>
              <p className="mt-1 text-sm leading-6 text-[rgb(var(--muted))]">
                {t.localImportAdvice}
              </p>
              <div className="mt-4 grid gap-3">
                <Field label={t.localGgufPath}>
                  <input
                    className={inputClass}
                    value={localGgufPath}
                    onChange={(event) => setLocalGgufPath(event.target.value)}
                    placeholder="/models/tinyllama.gguf"
                  />
                </Field>
                <Button
                  onClick={importLocalGguf}
                  disabled={modelLibraryPending || !localGgufPath.trim()}
                >
                  <UploadCloud size={15} />
                  {modelLibraryPending ? t.operationRunning : t.importLocalGguf}
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{t.ollamaBridge}</h3>
                <StatusPill
                  state={ollamaStatus?.running ? "ok" : ollamaStatus?.installed ? "warn" : "idle"}
                  label={
                    ollamaStatus?.running
                      ? `${t.ollamaRunning}${ollamaStatus.version ? ` ${ollamaStatus.version}` : ""}`
                      : ollamaStatus?.installed
                        ? t.ollamaNotRunning
                        : t.ollamaNotInstalled
                  }
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={startOllama} disabled={ollamaPending}>
                  <Play size={15} />
                  {ollamaPending ? t.operationRunning : t.startOllama}
                </Button>
              </div>
              <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted))]">
                {t.ollamaAdvice}
              </p>
              <div className="mt-4 grid gap-3">
                <Field label={t.searchOllamaModels}>
                  <input
                    className={inputClass}
                    value={ollamaQuery}
                    onChange={(event) => setOllamaQuery(event.target.value)}
                    placeholder={t.ollamaSearchPlaceholder}
                  />
                </Field>
                <div className="grid gap-2">
                  {ollamaCatalogModels.map((model) => (
                    <div
                      key={model.name}
                      className="rounded-2xl bg-[rgb(var(--surface-container-high))] p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold">{model.name}</div>
                          <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                            {model.family} · {model.sizeLabel} · {model.description}
                          </div>
                        </div>
                        <Button
                          className="h-9 px-3"
                          onClick={() => pullOllamaModel(model.name)}
                          disabled={ollamaPending}
                        >
                          <Download size={14} />
                          {t.ollamaPullModel}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Field label={t.customOllamaModel}>
                  <input
                    className={inputClass}
                    value={ollamaModelName}
                    onChange={(event) => setOllamaModelName(event.target.value)}
                    placeholder="qwen2.5:1.5b"
                  />
                </Field>
                <Button
                  onClick={() => pullOllamaModel(ollamaModelName)}
                  disabled={ollamaPending || !ollamaModelName.trim()}
                >
                  <Download size={15} />
                  {ollamaPending ? t.operationRunning : t.pullCustomOllamaModel}
                </Button>
              </div>
              <div className="mt-4 grid gap-2">
                <div className="text-sm font-semibold">{t.ollamaModels}</div>
                {ollamaModels.map((model) => (
                  <div
                    key={model.name}
                    className="rounded-2xl bg-[rgb(var(--surface-container-high))] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{model.name}</span>
                      <StatusPill
                        state={model.importable ? "warn" : "idle"}
                        label={model.importable ? t.importable : t.notImportable}
                      />
                      <Button
                        variant="secondary"
                        className="h-9 px-3"
                        onClick={() => pullOllamaModel(model.name)}
                        disabled={ollamaPending}
                      >
                        <Download size={14} />
                        {t.ollamaUpdateModel}
                      </Button>
                      <Button
                        variant="danger"
                        className="h-9 px-3"
                        onClick={() => deleteOllamaModel(model.name)}
                        disabled={ollamaPending}
                      >
                        <Trash2 size={14} />
                        {t.deleteModel}
                      </Button>
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[rgb(var(--muted))]">
                      {[model.family, model.format, model.quantization, bytesToSize(model.sizeBytes)]
                        .filter(Boolean)
                        .join(" · ")}
                      {model.reason ? ` · ${model.reason}` : ""}
                    </div>
                  </div>
                ))}
                {ollamaModels.length === 0 ? (
                  <div className="text-sm text-[rgb(var(--muted))]">{t.noOllamaModels}</div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </Panel>
    </div>
  );
}

function downloadPhaseLabel(phase: ModelDownloadJob["phase"], t: Dictionary) {
  if (phase === "downloading") return t.downloadPhaseDownloading;
  if (phase === "validating") return t.downloadPhaseValidating;
  if (phase === "probing") return t.downloadPhaseProbing;
  return t.downloadPhaseDone;
}

function estimateEtaSeconds(job: ModelDownloadJob) {
  if (!job.totalBytes || job.totalBytes <= 0) return undefined;
  const remainingBytes = job.totalBytes - job.downloadedBytes;
  if (remainingBytes <= 0) return 0;
  const startedAtMs = Date.parse(job.startedAt);
  const updatedAtMs = Date.parse(job.updatedAt);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(updatedAtMs)) return undefined;
  const elapsedSeconds = Math.max(1, (updatedAtMs - startedAtMs) / 1000);
  const speedBytesPerSecond = job.downloadedBytes / elapsedSeconds;
  if (!Number.isFinite(speedBytesPerSecond) || speedBytesPerSecond <= 0) return undefined;
  return Math.max(0, Math.ceil(remainingBytes / speedBytesPerSecond));
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours}h ${restMinutes}m`;
}
