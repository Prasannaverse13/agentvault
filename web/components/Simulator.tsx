"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type PositionView, type SimResult, type SimStep } from "@/lib/api";
import { cls, fmtNum, fmtPct, fmtUsd } from "@/lib/format";
import { Badge, Card, SectionTitle, Spinner } from "./ui";

type Props = {
  mode: "demo" | "live";
  vault?: string;
  position?: PositionView;
  onNeedVault?: () => void;
  request?: { id: number; scenario: string } | null;
};

const SCENARIOS = [
  { id: "crash", label: "Crash −45%", hint: "Slow bleed" },
  { id: "dip", label: "Dip −20%", hint: "Shock + recovery" },
  { id: "blackswan", label: "Black swan −55%", hint: "Violent crash" },
];

export function Simulator({ mode, vault, position, onNeedVault, request }: Props) {
  const [scenario, setScenario] = useState("crash");
  const [result, setResult] = useState<SimResult | null>(null);
  const [demoPosition, setDemoPosition] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  const run = useCallback(
    async (nextScenario: string) => {
      if (mode === "live" && !vault) {
        onNeedVault?.();
        return;
      }
      setLoading(true);
      setError(null);
      setScenario(nextScenario);
      try {
        if (mode === "demo") {
          const response = await api.demoSimulate(nextScenario);
          setDemoPosition(response.position);
          setResult(response.result);
        } else {
          const response = await api.simulate(vault as string, nextScenario);
          setResult(response);
        }
        setCursor(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simulation failed");
      } finally {
        setLoading(false);
      }
    },
    [mode, onNeedVault, vault],
  );

  useEffect(() => {
    if (mode === "demo") void run("crash");
  }, [mode, run]);

  useEffect(() => {
    if (request && mode === "live" && vault) {
      void run(request.scenario);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  useEffect(() => {
    if (!result) return;
    setCursor(0);
    const total = result.agentSteps.length;
    let index = 0;
    const id = setInterval(() => {
      index += 1;
      setCursor(index);
      if (index >= total - 1) clearInterval(id);
    }, 110);
    return () => clearInterval(id);
  }, [result]);

  const view = mode === "demo" ? demoPosition : position;
  const done = result ? cursor >= result.agentSteps.length - 1 : false;
  const visibleAgent = result ? result.agentSteps.slice(0, cursor + 1) : [];
  const visibleBaseline = result ? result.baselineSteps.slice(0, cursor + 1) : [];
  const activeStep = visibleAgent[visibleAgent.length - 1];

  return (
    <Card id="simulate" className="overflow-hidden p-5 sm:p-8">
      <SectionTitle
        title="Loan under stress"
        subtitle={
          mode === "demo"
            ? "A live simulation using the Mezo BTC oracle. Watch the agent defend the position."
            : "Replay a market crash against your live position. The agent acts at your trigger."
        }
        action={
          <Badge tone={mode === "demo" ? "accent" : "good"}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {mode === "demo" ? "Interactive demo" : "Your vault"}
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented flex-wrap">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            onClick={() => void run(item.id)}
            disabled={loading}
            className={cls(
              "segment inline-flex items-center gap-2 disabled:opacity-60",
              scenario === item.id && "segment-active",
            )}
            title={item.hint}
          >
            {loading && scenario === item.id ? <Spinner className="h-3.5 w-3.5" /> : null}
            {item.label}
          </button>
        ))}
        </div>
        {result ? (
          <span className="ml-auto text-[14px] font-semibold text-forest">
            BTC {fmtUsd(result.startPrice)} → {fmtUsd(result.endPrice)}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-panel border border-[#f3c4c6] bg-[#fbe4e5] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!result ? (
        <div className="mt-5 flex h-[300px] items-center justify-center rounded-panel bg-fog/60">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-slate">
              <Spinner /> Loading live position…
            </div>
          ) : (
            <p className="text-sm text-slate">Run a scenario to see the agent defend the loan.</p>
          )}
        </div>
      ) : (
        <>
          <Chart
            agent={visibleAgent}
            baseline={visibleBaseline}
            done={done}
            total={result.agentSteps.length}
          />

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat
              label="Agent actions"
              value={activeStep ? String(countActions(visibleAgent)) : "0"}
              tone="accent"
            />
            <MiniStat
              label="Min ICR · agent"
              value={fmtPct(visibleAgent.length ? Math.min(...visibleAgent.map((s) => s.icr)) : view?.icr ?? 0)}
              tone="good"
            />
            <MiniStat
              label="Min ICR · no agent"
              value={fmtPct(
                visibleBaseline.length ? Math.min(...visibleBaseline.map((s) => s.icr)) : view?.icr ?? 0,
              )}
              tone="danger"
            />
            <MiniStat
              label="Safety used"
              value={`${fmtNum(result.summary.totalTopUp, 3)} BTC`}
              sub={`${fmtNum(result.summary.totalRepay, 0)} MUSD repaid`}
            />
          </div>

          <div
            className={cls(
              "mt-4 flex items-start gap-4 rounded-panel px-5 py-4",
              result.summary.agentLiquidated
                ? "bg-[#fbe4e5]"
                : result.summary.baselineLiquidated
                  ? "bg-forest"
                  : "bg-fog",
            )}
          >
            <span
              className={cls(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-black",
                result.summary.agentLiquidated
                  ? "bg-danger text-paper"
                  : result.summary.baselineLiquidated
                    ? "bg-lime text-forest"
                    : "bg-paper text-forest",
              )}
            >
              {result.summary.agentLiquidated ? "!" : result.summary.baselineLiquidated ? "✓" : "◎"}
            </span>
            <div>
              <p
                className={cls(
                  "text-[17px] font-bold",
                  result.summary.agentLiquidated
                    ? "text-danger"
                    : result.summary.baselineLiquidated
                      ? "text-lime"
                      : "text-obsidian",
                )}
              >
                {result.summary.agentLiquidated
                  ? "Safety funds were not enough"
                  : result.summary.baselineLiquidated
                    ? "The agent saved the loan"
                    : "The loan survives either way"}
              </p>
              <p
                className={cls(
                  "mt-1 text-[14px] leading-relaxed",
                  result.summary.baselineLiquidated && !result.summary.agentLiquidated
                    ? "text-paper/85"
                    : "text-charcoal",
                )}
              >
                {result.summary.agentLiquidated
                  ? "Add more BTC buffer or MUSD reserve, or lower your trigger."
                  : result.summary.baselineLiquidated
                    ? `Without the agent, ICR would have fallen to ${fmtPct(result.summary.minICRBaseline)} and liquidated. The agent kept it at ${fmtPct(result.summary.minICRAgent)}.`
                    : "This scenario is not deep enough to threaten the loan. Try a black swan."}
              </p>
            </div>
          </div>

          <ActionLog steps={result.agentSteps.filter((step) => step.action !== "hold" && step.action !== "liquidated")} />
        </>
      )}
    </Card>
  );
}

function countActions(steps: SimStep[]): number {
  return steps.filter((s) => s.action !== "hold" && s.action !== "liquidated").length;
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "accent" | "good" | "danger";
}) {
  const color =
    tone === "good" ? "text-good" : tone === "danger" ? "text-danger" : "text-obsidian";
  return (
    <div className="rounded-panel bg-fog/60 px-4 py-3">
      <p className="text-[13px] font-medium text-slate">{label}</p>
      <p className={cls("mt-1 text-[20px] font-bold tracking-tight", color)}>{value}</p>
      {sub ? <p className="text-[12px] text-slate">{sub}</p> : null}
    </div>
  );
}

function Chart({
  agent,
  baseline,
  done,
  total,
}: {
  agent: SimStep[];
  baseline: SimStep[];
  done: boolean;
  total: number;
}) {
  const W = 760;
  const H = 300;
  const pad = { l: 46, r: 18, t: 22, b: 34 };
  const values = [...agent, ...baseline].map((s) => s.icr);
  const maxICR = Math.max(240, Math.ceil(Math.max(...values, 110) / 50) * 50);
  const minICR = 90;

  const x = (index: number) =>
    pad.l + (total <= 1 ? 0 : (index / (total - 1)) * (W - pad.l - pad.r));
  const y = (icr: number) =>
    pad.t + ((maxICR - Math.max(minICR, Math.min(maxICR, icr))) / (maxICR - minICR)) * (H - pad.t - pad.b);

  const line = (steps: SimStep[]) =>
    steps.map((step, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(step.icr).toFixed(1)}`).join(" ");

  const area =
    agent.length > 1
      ? `${line(agent)} L${x(agent.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`
      : "";

  const grid = [maxICR, maxICR * 0.75, maxICR * 0.5, 150, 110].filter(
    (v, i, arr) => v > minICR && arr.indexOf(v) === i,
  );

  const current = agent[agent.length - 1];

  return (
    <div className="relative mt-4 overflow-hidden rounded-panel border border-line bg-paper">
      <div className="flex items-center justify-between px-5 pt-4 text-[14px] font-medium text-slate">
        <span>Collateral ratio (ICR)</span>
        <span className="font-bold text-forest">
          {current ? `${fmtPct(current.icr)} · ${fmtUsd(current.price)} BTC` : "—"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ICR chart">
        <defs>
          <linearGradient id="agentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9fe870" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#9fe870" stopOpacity="0" />
          </linearGradient>
        </defs>

        {area ? <path d={area} fill="#e2f6d5" fillOpacity="0.85" /> : null}

        {grid.map((value) => (
          <g key={value}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(value)}
              y2={y(value)}
              stroke="#e8ebe6"
              strokeWidth="1"
              strokeDasharray={value === 110 ? "4 4" : undefined}
            />
            <text x={8} y={y(value) + 3} fill={value === 110 ? "#cb272f" : "#868685"} fontSize="11" fontWeight="600">
              {value.toFixed(0)}%
            </text>
          </g>
        ))}

        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={y(110)}
          y2={y(110)}
          stroke="#cb272f"
          strokeWidth="1.6"
          strokeDasharray="5 5"
          opacity="0.8"
        />
        <text x={W - pad.r - 78} y={y(110) - 6} fill="#cb272f" fontSize="11" fontWeight="700">
          liquidation 110%
        </text>

        {baseline.length > 1 ? (
          <path
            d={line(baseline)}
            fill="none"
            stroke="#868685"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        ) : null}

        {agent.length > 1 ? (
          <path
            d={line(agent)}
            fill="none"
            stroke="#163300"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {agent.map((step, index) => {
          if (step.action === "hold") return null;
          const color = step.action === "liquidated" ? "#cb272f" : step.action === "repay" ? "#0b4c72" : "#163300";
          return (
            <g key={`${step.t}-${step.action}`}>
              <circle cx={x(index)} cy={y(step.icr)} r="6" fill="#9fe870" stroke={color} strokeWidth="2.5" />
              <circle cx={x(index)} cy={y(step.icr)} r="2" fill={color} />
            </g>
          );
        })}

        {current ? (
          <g>
            <circle cx={x(agent.length - 1)} cy={y(current.icr)} r="11" fill="#9fe870" opacity="0.6" />
            <circle cx={x(agent.length - 1)} cy={y(current.icr)} r="5" fill="#163300" />
          </g>
        ) : null}

        <text x={pad.l} y={H - 10} fill="#868685" fontSize="11">
          start
        </text>
        <text x={W - pad.r - 22} y={H - 10} fill="#868685" fontSize="11">
          end
        </text>
        {!done ? (
          <text x={W / 2 - 28} y={pad.t + 4} fill="#6a6c6a" fontSize="11">
            replaying…
          </text>
        ) : null}
      </svg>
      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[14px] text-slate">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-forest" /> with agent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t border-t-2 border-dashed border-pebble" /> without agent
        </span>
        <span className="ml-auto">dark ring = top-up · blue ring = repay</span>
      </div>
    </div>
  );
}

function ActionLog({ steps }: { steps: SimStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="mt-4 text-[13px] text-slate">
        No agent action was needed in this path. Lower the trigger LTV to make the agent act earlier.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-1.5">
      {steps.slice(0, 4).map((step) => (
        <div
          key={`${step.t}-${step.action}`}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card bg-fog/60 px-4 py-2.5 text-[13px]"
        >
          <span className="text-slate">
            step {step.t} · BTC {fmtUsd(step.price)}
          </span>
          <span className="font-semibold text-obsidian">
            {step.action === "topUp"
              ? `top up ${fmtNum(step.topUp, 4)} BTC`
              : step.action === "repay"
                ? `repay ${fmtNum(step.repay, 0)} MUSD`
                : `top up ${fmtNum(step.topUp, 4)} BTC + repay ${fmtNum(step.repay, 0)} MUSD`}
          </span>
          <span className="font-semibold text-good">ICR {fmtPct(step.icr)}</span>
        </div>
      ))}
    </div>
  );
}
