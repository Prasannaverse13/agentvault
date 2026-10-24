"use client";

import { useEffect, useState } from "react";
import { api, type PositionView, type RiskReport } from "@/lib/api";
import { cls, fmtNum, fmtUsd } from "@/lib/format";
import { Card, SectionTitle } from "./ui";

const BANDS = {
  low: { label: "Low risk", bar: "bg-forest", text: "text-good" },
  moderate: { label: "Moderate risk", bar: "bg-[#a05a00]", text: "text-warn" },
  high: { label: "High risk", bar: "bg-danger", text: "text-danger" },
  critical: { label: "Critical", bar: "bg-danger", text: "text-danger" },
};

/** What the position can survive: unprotected vs with the agent and its safety funds. */
export function RiskCard({ vault, position }: { vault: string; position: PositionView }) {
  const [risk, setRisk] = useState<RiskReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .risk(vault)
      .then((next) => {
        if (alive) {
          setRisk(next);
          setFailed(false);
        }
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // Recompute whenever a fresh status snapshot arrives.
  }, [vault, position.fetchedAt]);

  const band = risk ? BANDS[risk.band] : null;
  const triggerPrice = position.coll > 0 ? (position.triggerICR / 100) * (position.debt / position.coll) : 0;

  return (
    <Card className="h-full">
      <SectionTitle
        title="Risk insight"
        subtitle="How far BTC can fall before your loan is in trouble."
        action={
          band ? (
            <span className={cls("badge bg-fog", band.text)}>{band.label}</span>
          ) : null
        }
      />

      {!risk ? (
        <p className="rounded-panel bg-fog/60 px-4 py-8 text-center text-[14px] text-slate">
          {failed ? "Risk analysis needs the agent service." : "Analysing your position…"}
        </p>
      ) : !risk.active ? (
        <p className="rounded-panel bg-fog/60 px-4 py-8 text-center text-[14px] text-slate">
          No active loan to analyse. Open a loan to see how much BTC drop it can take.
        </p>
      ) : (
        <>
          <div className="rounded-panel bg-fog/70 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate">Risk score</p>
                <p className="text-[32px] font-black leading-none tracking-[-0.04em] text-forest">
                  {risk.score}
                  <span className="text-[16px] font-bold text-slate"> / 100</span>
                </p>
              </div>
              <p className="max-w-[170px] text-right text-[12px] text-slate">Lower is safer. Based on distance to liquidation and your safety funds.</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper">
              <div
                className={cls("h-full rounded-full transition-all", band?.bar)}
                style={{ width: `${Math.max(4, risk.score)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <Row
              label="Agent steps in at"
              value={`−${fmtNum(risk.dropToTrigger, 1)}%`}
              sub={triggerPrice ? `BTC ≈ ${fmtUsd(triggerPrice)}` : undefined}
            />
            <Row
              label="Liquidated without the agent at"
              value={`−${fmtNum(risk.dropToLiquidation, 1)}%`}
              sub={`BTC ≈ ${fmtUsd(position.liquidationPrice)}`}
              tone="danger"
            />
            <Row
              label="Protected through a drop of"
              value={`−${fmtNum(risk.survivableDropWithAgent, 1)}%`}
              sub={`with ${fmtUsd(risk.safetyFundsUsd)} of safety funds`}
              tone="good"
              strong
            />
          </div>

          <p className="mt-4 rounded-card bg-mist px-4 py-3 text-[13px] font-medium text-forest">
            Safety funds cover {fmtNum(risk.coveragePct, 0)}% of your debt.{" "}
            {risk.survivableDropWithAgent > risk.dropToLiquidation
              ? `The agent adds ${fmtNum(risk.survivableDropWithAgent - risk.dropToLiquidation, 1)} points of protection.`
              : "Add a BTC buffer or MUSD reserve so the agent has something to work with."}
          </p>
        </>
      )}
    </Card>
  );
}

function Row({
  label,
  value,
  sub,
  tone,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "danger";
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card px-1 py-1">
      <div>
        <p className={cls("text-[14px]", strong ? "font-bold text-obsidian" : "font-medium text-charcoal")}>{label}</p>
        {sub ? <p className="text-[12px] text-slate">{sub}</p> : null}
      </div>
      <p
        className={cls(
          "shrink-0 text-[20px] font-black tracking-tight",
          tone === "good" ? "text-good" : tone === "danger" ? "text-danger" : "text-obsidian",
        )}
      >
        {value}
      </p>
    </div>
  );
}
