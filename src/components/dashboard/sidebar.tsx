import { Activity, Bot, Database, Download, LogOut, Play, Settings, Square, Stethoscope, Terminal, Zap } from "lucide-react";
import { Button, StatusPill } from "@/components/ui";
import type { DashboardTab } from "./types";
import { serviceLabel, serviceTone } from "./utils";
import type { Dictionary } from "@/lib/i18n";
import type { ServiceState } from "@/lib/shimmy/types";

interface SidebarProps {
  t: Dictionary;
  tab: DashboardTab;
  setTab: (tab: DashboardTab) => void;
  statusState: ServiceState;
  start: () => void;
  stop: () => void;
  logout: () => void;
  startPending: boolean;
  stopPending: boolean;
  logoutPending: boolean;
}

export function Sidebar({
  t,
  tab,
  setTab,
  statusState,
  start,
  stop,
  logout,
  startPending,
  stopPending,
  logoutPending,
}: SidebarProps) {
  const canStart =
    statusState !== "running-managed" &&
    statusState !== "running-external" &&
    statusState !== "missing-binary";
  const nav = [
    { id: "overview" as const, label: t.overview, icon: <Activity size={16} /> },
    { id: "models" as const, label: t.models, icon: <Database size={16} /> },
    { id: "chat" as const, label: t.chat, icon: <Bot size={16} /> },
    { id: "runtime" as const, label: t.runtime, icon: <Download size={16} /> },
    { id: "config" as const, label: t.config, icon: <Settings size={16} /> },
    { id: "logs" as const, label: t.logs, icon: <Terminal size={16} /> },
    { id: "diagnostics" as const, label: t.diagnostics, icon: <Stethoscope size={16} /> },
  ];

  return (
    <aside className="relative z-50 rounded-[32px] bg-[rgb(var(--surface-container))] p-4 shadow-material lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--primary-container))] text-[rgb(var(--on-primary-container))]">
          <Zap size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-normal">{t.appName}</h1>
          <p className="text-xs text-[rgb(var(--muted))]">{t.subtitle}</p>
        </div>
      </div>

      <div className="mt-5">
        <StatusPill
          state={serviceTone(statusState)}
          label={serviceLabel(statusState, t)}
        />
      </div>

      <nav className="mt-6 hidden gap-1.5 lg:grid">
        {nav.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex h-12 items-center gap-3 rounded-full px-4 text-sm font-semibold transition duration-200 ${
              tab === item.id
                ? "bg-[rgb(var(--secondary-container))] text-[rgb(var(--on-secondary-container))]"
                : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-container-high))] hover:text-[rgb(var(--text))]"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button onClick={start} disabled={!canStart || startPending} className="w-full">
          <Play size={15} />
          {t.start}
        </Button>
        <Button
          variant="secondary"
          onClick={stop}
          disabled={statusState !== "running-managed" || stopPending}
          className="w-full"
        >
          <Square size={15} />
          {t.stop}
        </Button>
      </div>

      <div className="mt-2">
        <Button variant="ghost" onClick={logout} disabled={logoutPending} className="w-full">
          <LogOut size={15} />
          {t.logout}
        </Button>
      </div>

      {statusState === "missing-binary" ? (
        <p className="mt-4 rounded-3xl bg-[rgb(var(--error-container))] p-4 text-xs leading-5 text-[rgb(var(--error))]">
          {t.setupHint}
        </p>
      ) : null}

    </aside>
  );
}

export function MobileNavigation({
  t,
  tab,
  setTab,
}: Pick<SidebarProps, "t" | "tab" | "setTab">) {
  const nav = [
    { id: "overview" as const, label: t.overview, icon: <Activity size={16} /> },
    { id: "models" as const, label: t.models, icon: <Database size={16} /> },
    { id: "chat" as const, label: t.chat, icon: <Bot size={16} /> },
    { id: "runtime" as const, label: t.runtime, icon: <Download size={16} /> },
    { id: "config" as const, label: t.config, icon: <Settings size={16} /> },
    { id: "logs" as const, label: t.logs, icon: <Terminal size={16} /> },
    { id: "diagnostics" as const, label: t.diagnostics, icon: <Stethoscope size={16} /> },
  ];

  return (
    <nav
      className="pointer-events-auto fixed bottom-3 left-3 right-3 z-[90] grid grid-cols-7 rounded-[28px] border border-[rgb(var(--line))]/70 bg-[rgb(var(--surface-container))]/95 p-2 shadow-material backdrop-blur lg:hidden"
      style={{ zIndex: 1000 }}
    >
      {nav.map((item) => (
        <button
          key={item.id}
          onClick={() => setTab(item.id)}
          className={`flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition ${
            tab === item.id
              ? "bg-[rgb(var(--secondary-container))] text-[rgb(var(--on-secondary-container))]"
              : "text-[rgb(var(--muted))]"
          }`}
        >
          {item.icon}
          <span className="w-full truncate">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
