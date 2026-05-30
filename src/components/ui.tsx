import { clsx } from "clsx";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...values: Parameters<typeof clsx>) {
  return twMerge(clsx(values));
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-[rgb(var(--line))]/70 bg-[rgb(var(--panel))] shadow-glow",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" &&
          "bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] shadow-material hover:brightness-105 active:scale-[0.98]",
        variant === "secondary" &&
          "bg-[rgb(var(--secondary-container))] text-[rgb(var(--on-secondary-container))] hover:brightness-105 active:scale-[0.98]",
        variant === "danger" &&
          "bg-[rgb(var(--error-container))] text-[rgb(var(--error))] hover:brightness-110 active:scale-[0.98]",
        variant === "ghost" &&
          "text-[rgb(var(--primary))] hover:bg-[rgb(var(--primary))]/10 active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm text-[rgb(var(--muted))]">
      <span className="px-1 text-xs font-semibold tracking-normal">{label}</span>
      {children}
    </label>
  );
}

export function LinearProgress({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-container-high))]",
        className,
      )}
    >
      <div className="h-full w-1/2 animate-[progress-slide_1.2s_ease-in-out_infinite] rounded-full bg-[rgb(var(--primary))]" />
    </div>
  );
}

export function Snackbar({
  kind,
  title,
  description,
  onDismiss,
}: {
  kind: "success" | "error" | "info";
  title: string;
  description?: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={cn(
        "fixed bottom-4 right-4 z-50 grid max-w-md gap-2 rounded-[24px] border p-4 pr-12 text-sm shadow-material",
        kind === "error" &&
          "border-[rgb(var(--error))]/30 bg-[rgb(var(--error-container))] text-[rgb(var(--error))]",
        kind === "success" &&
          "border-[rgb(var(--success))]/25 bg-[rgb(var(--surface-container-high))] text-[rgb(var(--text))]",
        kind === "info" &&
          "border-[rgb(var(--primary))]/25 bg-[rgb(var(--surface-container-high))] text-[rgb(var(--text))]",
      )}
    >
      <div className="font-semibold">{title}</div>
      {description ? <div className="leading-5 opacity-85">{description}</div> : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full px-2 text-lg leading-none hover:bg-current/10"
      >
        ×
      </button>
    </div>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-[28px] border border-[rgb(var(--line))]/70 bg-[rgb(var(--panel))] p-6 shadow-material"
      >
        <h2 id="confirm-dialog-title" className="text-xl font-semibold">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[rgb(var(--muted))]">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "danger" : "secondary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-transparent bg-[rgb(var(--surface-container-high))] px-4 text-sm text-[rgb(var(--text))] outline-none transition placeholder:text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-variant))]/45 focus:border-[rgb(var(--primary))] focus:bg-[rgb(var(--surface-container-high))]";

export const textareaClass =
  "min-h-32 w-full rounded-3xl border border-transparent bg-[rgb(var(--surface-container-high))] p-4 text-sm text-[rgb(var(--text))] outline-none transition placeholder:text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-variant))]/45 focus:border-[rgb(var(--primary))] focus:bg-[rgb(var(--surface-container-high))]";

export function StatusPill({
  state,
  label,
}: {
  state: "ok" | "warn" | "error" | "idle";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        state === "ok" && "bg-[rgb(var(--success))]/16 text-[rgb(var(--success))]",
        state === "warn" && "bg-[rgb(var(--warn))]/18 text-[rgb(var(--warn))]",
        state === "error" && "bg-[rgb(var(--error-container))] text-[rgb(var(--error))]",
        state === "idle" && "bg-[rgb(var(--surface-container-high))] text-[rgb(var(--muted))]",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
