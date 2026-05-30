import { Languages, Moon, Save, Sun } from "lucide-react";
import { Button, Field, inputClass, Panel } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { ModelDirectoriesHealth, ShimmyUiConfig } from "@/lib/shimmy/types";

interface ConfigPanelProps {
  t: Dictionary;
  localConfig: ShimmyUiConfig;
  modelDirsHealth?: ModelDirectoriesHealth;
  setLocalConfig: React.Dispatch<React.SetStateAction<ShimmyUiConfig>>;
  markDirty: () => void;
  saveSettings: () => void;
  savePending: boolean;
}

export function ConfigPanel({
  t,
  localConfig,
  modelDirsHealth,
  setLocalConfig,
  markDirty,
  saveSettings,
  savePending,
}: ConfigPanelProps) {
  function update(patch: Partial<ShimmyUiConfig>) {
    markDirty();
    setLocalConfig((current) => ({ ...current, ...patch }));
  }

  return (
    <Panel className="p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t.shimmyPath}>
          <input
            className={inputClass}
            value={localConfig.shimmyPath ?? ""}
            onChange={(event) =>
              update({ shimmyPath: event.target.value || undefined })
            }
            placeholder="/usr/local/bin/shimmy"
          />
        </Field>
        <Field label={t.bindAddress}>
          <input
            className={inputClass}
            value={localConfig.bindAddress}
            onChange={(event) => update({ bindAddress: event.target.value })}
          />
        </Field>
        <Field label={t.modelDirs}>
          <input
            className={inputClass}
            value={localConfig.modelDirs.join(";")}
            onChange={(event) =>
              update({
                modelDirs: event.target.value
                  .split(";")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder="/models;/Volumes/LLM"
          />
          <span className="text-xs leading-5 text-[rgb(var(--muted))]">
            {modelDirsHealth?.hasModels
              ? `${t.modelDirsReady} ${modelDirsHealth.totalGgufFiles}`
              : modelDirsHealth?.hasReadableDirectory
                ? t.modelDirsMissingGguf
                : t.modelDirsNotConfigured}
          </span>
        </Field>
        <Field label={t.baseGguf}>
          <input
            className={inputClass}
            value={localConfig.baseGguf ?? ""}
            onChange={(event) =>
              update({ baseGguf: event.target.value || undefined })
            }
            placeholder="/models/tinyllama.gguf"
          />
        </Field>
        <Field label={t.maxCtx}>
          <input
            className={inputClass}
            type="number"
            min="512"
            max="131072"
            value={localConfig.maxCtx ?? ""}
            onChange={(event) =>
              update({
                maxCtx: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          />
        </Field>
        <Field label={t.gpuBackend}>
          <select
            className={inputClass}
            value={localConfig.gpuBackend}
            onChange={(event) =>
              update({
                gpuBackend: event.target.value as ShimmyUiConfig["gpuBackend"],
              })
            }
          >
            <option value="auto">auto</option>
            <option value="cpu">cpu</option>
            <option value="cuda">cuda</option>
            <option value="vulkan">vulkan</option>
            <option value="opencl">opencl</option>
          </select>
        </Field>
        <Field label={t.language}>
          <select
            className={inputClass}
            value={localConfig.language}
            onChange={(event) =>
              update({
                language: event.target.value as ShimmyUiConfig["language"],
              })
            }
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={t.theme}>
          <select
            className={inputClass}
            value={localConfig.theme}
            onChange={(event) =>
              update({ theme: event.target.value as ShimmyUiConfig["theme"] })
            }
          >
            <option value="dark">{t.dark}</option>
            <option value="light">{t.light}</option>
            <option value="system">{t.system}</option>
          </select>
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            update({ language: localConfig.language === "en" ? "zh" : "en" })
          }
        >
          <Languages size={15} />
          {t.language}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            update({ theme: localConfig.theme === "light" ? "dark" : "light" })
          }
        >
          {localConfig.theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
          {t.theme}
        </Button>
        <Button onClick={saveSettings} disabled={savePending}>
          <Save size={15} />
          {t.save}
        </Button>
      </div>
    </Panel>
  );
}
