import { Clipboard, RotateCcw, Send, Square } from "lucide-react";
import { Button, Field, inputClass, Panel, textareaClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { ShimmyModel } from "@/lib/shimmy/types";
import type { ChatHistoryItem, ChatPresetId, GenerationSettings } from "./types";

interface ChatPanelProps {
  t: Dictionary;
  modelRows: ShimmyModel[];
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  generation: GenerationSettings;
  setGeneration: React.Dispatch<React.SetStateAction<GenerationSettings>>;
  chatPrompt: string;
  setChatPrompt: (value: string) => void;
  chatOutput: string;
  chatBusy: boolean;
  runChat: () => void;
  stopChat: () => void;
  copyResponse: (response: string) => void;
  applyPreset: (preset: ChatPresetId) => void;
  chatHistory: ChatHistoryItem[];
  restoreHistory: (item: ChatHistoryItem) => void;
}

export function ChatPanel({
  t,
  modelRows,
  selectedModel,
  setSelectedModel,
  generation,
  setGeneration,
  chatPrompt,
  setChatPrompt,
  chatOutput,
  chatBusy,
  runChat,
  stopChat,
  copyResponse,
  applyPreset,
  chatHistory,
  restoreHistory,
}: ChatPanelProps) {
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
      <Panel className="min-w-0 p-6">
        <div className="grid gap-5">
          <Field label={t.model}>
            <select
              className={inputClass}
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
            >
              <option value="">{t.selectModel}</option>
              {modelRows.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <div className="mb-2 px-1 text-xs font-semibold text-[rgb(var(--muted))]">
              {t.presets}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["precise", t.precisePreset],
                ["balanced", t.balancedPreset],
                ["creative", t.creativePreset],
              ].map(([preset, label]) => (
                <Button
                  key={preset}
                  type="button"
                  variant="secondary"
                  className="px-3"
                  onClick={() => applyPreset(preset as ChatPresetId)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <Field label={t.temperature}>
            <input
              className={inputClass}
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={generation.temperature}
              onChange={(event) =>
                setGeneration((current) => ({
                  ...current,
                  temperature: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field label={t.topP}>
            <input
              className={inputClass}
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={generation.topP}
              onChange={(event) =>
                setGeneration((current) => ({
                  ...current,
                  topP: Number(event.target.value),
                }))
              }
            />
          </Field>
          <Field label={t.maxTokens}>
            <input
              className={inputClass}
              type="number"
              min="1"
              max="131072"
              value={generation.maxTokens}
              onChange={(event) =>
                setGeneration((current) => ({
                  ...current,
                  maxTokens: Number(event.target.value),
                }))
              }
            />
          </Field>
        </div>
      </Panel>
      <Panel className="min-w-0 p-6">
        <div className="grid gap-5">
          <Field label={t.prompt}>
            <textarea
              className={textareaClass}
              value={chatPrompt}
              onChange={(event) => setChatPrompt(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            {chatBusy ? (
              <Button type="button" variant="secondary" onClick={stopChat}>
                <Square size={15} />
                {t.stopGeneration}
              </Button>
            ) : null}
            <Button onClick={runChat} disabled={chatBusy || !selectedModel}>
              <Send size={15} />
              {t.send}
            </Button>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-[rgb(var(--muted))]">
              <span>{t.response}</span>
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-3"
                disabled={!chatOutput}
                onClick={() => copyResponse(chatOutput)}
              >
                <Clipboard size={14} />
                {t.copyResponse}
              </Button>
            </div>
            <pre className="min-h-64 whitespace-pre-wrap break-words rounded-[28px] bg-[rgb(var(--surface-container-high))] p-5 text-sm text-[rgb(var(--text))]">
              {chatOutput || "-"}
            </pre>
          </div>
        </div>
      </Panel>
      <Panel className="min-w-0 p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{t.history}</h2>
          <span className="rounded-full bg-[rgb(var(--surface-container-high))] px-3 py-1 text-xs font-semibold text-[rgb(var(--muted))]">
            {chatHistory.length}
          </span>
        </div>
        {chatHistory.length ? (
          <div className="grid gap-3">
            {chatHistory.map((item) => (
              <article
                key={item.id}
                className="min-w-0 rounded-3xl bg-[rgb(var(--surface-container-high))] p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-xs font-semibold text-[rgb(var(--muted))]">
                    {item.model}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-3"
                    onClick={() => restoreHistory(item)}
                  >
                    <RotateCcw size={14} />
                    {t.restore}
                  </Button>
                </div>
                <div className="line-clamp-2 break-words text-sm font-semibold">
                  {item.prompt}
                </div>
                <div className="mt-2 line-clamp-3 break-words text-xs leading-5 text-[rgb(var(--muted))]">
                  {item.response || "-"}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-[rgb(var(--surface-container-high))] p-4 text-sm text-[rgb(var(--muted))]">
            {t.noChatHistory}
          </div>
        )}
      </Panel>
    </div>
  );
}
