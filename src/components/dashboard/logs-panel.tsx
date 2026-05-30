import { Download, FileText } from "lucide-react";
import { Button, inputClass, Panel } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import type { LogEntry } from "@/lib/shimmy/types";
import type { LogStreamFilter } from "./types";
import { useEffect, useRef } from "react";

interface LogsPanelProps {
  t: Dictionary;
  logsFilter: string;
  setLogsFilter: (value: string) => void;
  logsStream: LogStreamFilter;
  setLogsStream: (value: LogStreamFilter) => void;
  autoScroll: boolean;
  setAutoScroll: (value: boolean) => void;
  filteredLogs: LogEntry[];
  clearLogs: () => void | Promise<void>;
}

export function LogsPanel({
  t,
  logsFilter,
  setLogsFilter,
  logsStream,
  setLogsStream,
  autoScroll,
  setAutoScroll,
  filteredLogs,
  clearLogs,
}: LogsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const logText = filteredLogs
    .map((entry) => `[${entry.time}] ${entry.stream}: ${entry.message}`)
    .join("\n");

  useEffect(() => {
    if (!autoScroll) return;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [autoScroll, filteredLogs]);

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--line))]/60 p-5">
        <h2 className="text-2xl font-semibold">{t.logs}</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className={`${inputClass} w-36`}
            value={logsStream}
            onChange={(event) => setLogsStream(event.target.value as LogStreamFilter)}
          >
            <option value="all">{t.allStreams}</option>
            <option value="stdout">{t.stdout}</option>
            <option value="stderr">{t.stderr}</option>
            <option value="system">{t.systemStream}</option>
          </select>
          <input
            className={`${inputClass} w-52`}
            value={logsFilter}
            onChange={(event) => setLogsFilter(event.target.value)}
            placeholder={t.filter}
          />
          <label className="flex h-12 items-center gap-2 rounded-2xl bg-[rgb(var(--surface-container-high))] px-3 text-sm text-[rgb(var(--muted))]">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.target.checked)}
            />
            {t.autoScroll}
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(logText);
            }}
          >
            <FileText size={15} />
            {t.copy}
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportLogs(logText)}
          >
            <Download size={15} />
            {t.exportLogs}
          </Button>
          <Button variant="secondary" onClick={clearLogs}>
            <FileText size={15} />
            {t.clear}
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-[70vh] overflow-auto bg-[rgb(var(--surface-container-high))] p-5 font-mono text-xs text-[rgb(var(--text))]">
        {filteredLogs.map((entry) => (
          <div
            key={entry.id}
            className="grid grid-cols-[88px_64px_1fr] gap-3 rounded-2xl px-3 py-1.5 hover:bg-[rgb(var(--surface-variant))]/35"
          >
            <span className="text-[rgb(var(--muted))]">{entry.time.slice(11, 19)}</span>
            <span
              className={
                entry.stream === "stderr"
                  ? "text-[rgb(var(--error))]"
                  : entry.stream === "system"
                    ? "text-[rgb(var(--primary))]"
                    : "text-[rgb(var(--muted))]"
              }
            >
              {entry.stream}
            </span>
            <span className="break-words">{entry.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 ? (
          <div className="text-[rgb(var(--muted))]">{t.noLogs}</div>
        ) : null}
      </div>
    </Panel>
  );
}

function exportLogs(logText: string) {
  const blob = new Blob([logText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `shimmy-ui-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}
