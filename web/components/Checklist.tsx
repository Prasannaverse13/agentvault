"use client";

import type { PositionView } from "@/lib/api";
import { cls } from "@/lib/format";
import { Card } from "./ui";

type Step = {
  id: string;
  title: string;
  done: boolean;
  hint: string;
  action?: { label: string; onClick: () => void };
};

/** Setup progress derived from the live position, so it can never drift from reality. */
export function Checklist({
  position,
  isOwner,
  onOpenLoan,
  onFocus,
}: {
  position: PositionView;
  isOwner: boolean;
  onOpenLoan: () => void;
  onFocus: (section: "actions" | "rules" | "alerts") => void;
}) {
  const steps: Step[] = [
    {
      id: "loan",
      title: "Open a loan",
      done: position.status === 1,
      hint: "Deposit BTC and borrow MUSD from your vault.",
      action: isOwner ? { label: "Open loan", onClick: onOpenLoan } : undefined,
    },
    {
      id: "buffer",
      title: "Fund a BTC buffer",
      done: position.btcBuffer > 0,
      hint: "BTC the agent may add as collateral when the price falls.",
      action: isOwner ? { label: "Add buffer", onClick: () => onFocus("actions") } : undefined,
    },
    {
      id: "reserve",
      title: "Fund a MUSD reserve",
      done: position.musdReserve > 0,
      hint: "MUSD the agent may use to repay debt.",
      action: isOwner ? { label: "Add reserve", onClick: () => onFocus("actions") } : undefined,
    },
    {
      id: "armed",
      title: "Arm the agent",
      done: position.autoProtect && position.agentConnected,
      hint: "Auto-protect must be on and the agent authorised on the vault.",
      action: isOwner ? { label: "Open rules", onClick: () => onFocus("rules") } : undefined,
    },
  ];

  const completed = steps.filter((step) => step.done).length;
  if (completed === steps.length) return null;
  const next = steps.find((step) => !step.done);
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <Card className="mb-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="heading text-[22px]">Finish setting up</h2>
          <p className="mt-1 text-[14px] text-slate">
            {completed} of {steps.length} done. Next: <span className="font-semibold text-forest">{next?.title}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-40 overflow-hidden rounded-full bg-fog">
            <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[14px] font-bold text-forest">{pct}%</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cls(
              "flex flex-col rounded-panel p-4",
              step.done ? "bg-mist" : step.id === next?.id ? "bg-fog shadow-subtle" : "bg-fog/60",
            )}
          >
            <span
              className={cls(
                "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-black",
                step.done ? "bg-forest text-lime" : "bg-paper text-slate shadow-subtle",
              )}
            >
              {step.done ? "✓" : steps.indexOf(step) + 1}
            </span>
            <p className="mt-3 text-[15px] font-bold text-obsidian">{step.title}</p>
            <p className="mt-1 flex-1 text-[13px] leading-relaxed text-slate">{step.hint}</p>
            {!step.done && step.action ? (
              <button
                className={cls(
                  "mt-3 self-start rounded-full px-4 py-1.5 text-[13px] font-bold transition",
                  step.id === next?.id ? "bg-lime text-forest hover:bg-[#8fdc5e]" : "bg-paper text-forest hover:bg-mist",
                )}
                onClick={step.action.onClick}
              >
                {step.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
