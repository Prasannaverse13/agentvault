"use client";

import type { ReactNode } from "react";
import { cls } from "@/lib/format";

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cls("card p-5", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({
  title,
  action,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "good" | "warn" | "danger" | "accent";
  className?: string;
}) {
  const tones = {
    default: "border-line bg-white/5 text-muted",
    good: "border-mint/30 bg-mint/10 text-mint",
    warn: "border-ember/30 bg-ember/10 text-ember",
    danger: "border-accent/35 bg-accent/10 text-accent",
    accent: "border-accent/30 bg-accent/10 text-accent",
  };
  return <span className={cls("badge", tones[tone], className)}>{children}</span>;
}

export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cls("rounded-xl border border-line/70 bg-ink/40 px-3.5 py-3", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cls(
        "relative h-6 w-11 rounded-full border transition disabled:opacity-40",
        checked ? "border-mint/40 bg-mint/25" : "border-line bg-ink",
      )}
    >
      <span
        className={cls(
          "absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all",
          checked ? "left-[22px] bg-mint" : "left-0.5 bg-muted",
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cls(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white",
        className,
      )}
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cls(
          "relative w-full overflow-y-auto rounded-2xl border border-line bg-panel shadow-soft",
          width,
        )}
        style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button className="btn btn-ghost h-8 px-2.5 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Toast({
  toast,
}: {
  toast: { message: string; kind: "ok" | "err" } | null;
}) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-up">
      <div
        className={cls(
          "rounded-xl border px-4 py-3 text-sm shadow-soft",
          toast.kind === "ok"
            ? "border-mint/30 bg-[#0b1a14] text-mint"
            : "border-accent/40 bg-[#1a0b10] text-accent",
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}
