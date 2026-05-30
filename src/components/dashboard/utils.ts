import type { Dictionary } from "@/lib/i18n";
import type { ServiceState } from "@/lib/shimmy/types";

export function serviceLabel(state: ServiceState, t: Dictionary) {
  const map: Record<ServiceState, string> = {
    "missing-binary": t.missingBinary,
    stopped: t.stopped,
    starting: t.starting,
    "running-managed": t.managed,
    "running-external": t.external,
    error: t.error,
  };
  return map[state];
}

export function serviceTone(state: ServiceState): "ok" | "warn" | "error" | "idle" {
  if (state === "running-managed" || state === "running-external") return "ok";
  if (state === "starting") return "warn";
  if (state === "missing-binary" || state === "error") return "error";
  return "idle";
}

export function bytesToSize(value?: number) {
  if (!value) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}
