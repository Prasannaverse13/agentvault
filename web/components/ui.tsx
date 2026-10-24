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
    <section id={id} className={cls("card scroll-mt-24 p-6", className)}>
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
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="heading text-[22px]">{title}</h2>
        {subtitle ? <p className="mt-1 text-[14px] leading-relaxed text-slate">{subtitle}</p> : null}
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
    default: "bg-fog text-forest",
    good: "bg-mist text-good",
    warn: "bg-[#fdf0d5] text-warn",
    danger: "bg-[#fbe4e5] text-danger",
    accent: "bg-forest text-lime",
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
    <div className={cls("rounded-panel bg-fog/70 px-4 py-3.5", className)}>
      <p className="text-[13px] font-medium text-slate">{label}</p>
      <p className="mt-1 text-[20px] font-bold tracking-tight text-obsidian">{value}</p>
      {sub ? <p className="mt-0.5 text-[12px] text-slate">{sub}</p> : null}
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
        "relative h-7 w-12 rounded-full transition disabled:opacity-40",
        checked ? "bg-forest" : "bg-fog shadow-subtle",
      )}
    >
      <span
        className={cls(
          "absolute top-1 rounded-full transition-all",
          checked ? "left-6 bg-lime" : "left-1 bg-pebble",
        )}
        style={{ height: 20, width: 20 }}
      />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cls(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70",
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
        className="absolute inset-0 bg-obsidian/50"
        onClick={onClose}
      />
      <div
        className={cls("relative w-full overflow-y-auto rounded-large bg-paper shadow-xl", width)}
        style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-start justify-between gap-4 px-7 pb-2 pt-7">
          <div>
            <h2 className="heading text-[28px]">{title}</h2>
            {subtitle ? <p className="mt-1 text-[15px] text-slate">{subtitle}</p> : null}
          </div>
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fog text-forest transition hover:bg-mist"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-7 pb-7 pt-4">{children}</div>
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
    <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 animate-fade-up">
      <div
        className={cls(
          "flex items-start gap-3 rounded-panel px-4 py-3.5 text-[14px] font-medium shadow-xl",
          toast.kind === "ok" ? "bg-forest text-paper" : "bg-danger text-paper",
        )}
      >
        <span
          className={cls(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
            toast.kind === "ok" ? "bg-lime text-forest" : "bg-paper text-danger",
          )}
        >
          {toast.kind === "ok" ? "✓" : "!"}
        </span>
        {toast.message}
      </div>
    </div>
  );
}
