import { Download, Play, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { Button, Field, inputClass, Panel, StatusPill } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { ModelDirectoriesHealth, ShimmyModel } from "@/lib/shimmy/types";
import type {
  CatalogModel,
  DiscoverSummary,
  ManagedModel,
  OllamaCatalogModel,
  OllamaModel,
  OllamaStatus,
} from "./types";
import { bytesToSize } from "./utils";

interface ModelsPanelProps {
  t: Dictionary;
  modelRows: ShimmyModel[];
  defaultModel?: string;
  catalogModels: CatalogModel[];
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
  ollamaPending: boolean;
  modelDirsHealth?: ModelDirectoriesHealth;
  discoverPending: boolean;
  discoverSummary?: DiscoverSummary | null;
  discover: () => void;
  setLocalGgufPath: (path: string) => void;
  setCatalogQuery: (query: string) => void;
  setOllamaQuery: (query: string) => void;
  setOllamaModelName: (name: string) => void;
  setEditingManagedModel: (name: string | null) => void;
  setManagedModelNameDraft: (name: string) => void;
  importLocalGguf: () => void;
  downloadCatalogModel: (modelId: string) => void;
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
  ollamaPending,
  modelDirsHealth,
  discoverPending,
  discoverSummary,
  discover,
  setLocalGgufPath,
  setCatalogQuery,
  setOllamaQuery,
  setOllamaModelName,
  setEditingManagedModel,
  setManagedModelNameDraft,
  importLocalGguf,
  downloadCatalogModel,
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
              <h3 className="text-lg font-semibold">{t.curatedModels}</h3>
              <StatusPill state="ok" label="GGUF" />
            </div>
            <Field label={t.searchGgufModels}>
              <input
                className={inputClass}
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </Field>
            <div className="grid gap-3">
              {catalogModels.map((model) => {
                const installed = managedModels.some((item) => item.catalogId === model.id);
                return (
                  <article
                    key={model.id}
                    className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words text-base font-semibold">{model.name}</div>
                        {model.description ? (
                          <p className="mt-1 text-sm leading-6 text-[rgb(var(--muted))]">
                            {model.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[rgb(var(--muted))]">
                          <span>{t.architecture}: {model.architecture}</span>
                          <span>{t.quantization}: {model.quantization}</span>
                          <span>{t.size}: {bytesToSize(model.sizeBytes)}</span>
                          <span>{t.license}: {model.license}</span>
                          {model.minRamGb ? <span>{t.minRam}: {model.minRamGb} GB</span> : null}
                        </div>
                      </div>
                      <StatusPill
                        state={installed ? "ok" : "idle"}
                        label={installed ? t.installedModel : t.notInstalled}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => downloadCatalogModel(model.id)}
                        disabled={modelLibraryPending || installed}
                      >
                        <Download size={15} />
                        {modelLibraryPending ? t.operationRunning : t.downloadAndVerify}
                      </Button>
                    </div>
                  </article>
                );
              })}
              {catalogModels.length === 0 ? (
                <p className="rounded-[24px] bg-[rgb(var(--panel-2))] p-4 text-sm text-[rgb(var(--muted))]">
                  {t.noModels}
                </p>
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
