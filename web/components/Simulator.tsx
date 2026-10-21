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
  { id: "crash", label: "Crash −35%", hint: "Slow bleed" },
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
    <Card id="simulate" className="overflow-hidden">
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

      <div className="flex flex-wrap items-center gap-2">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            onClick={() => void run(item.id)}
            disabled={loading}
            className={cls(
              "btn px-3 py-2 text-xs",
              scenario === item.id ? "border-accent/50 bg-accent/10 text-white" : "",
            )}
            title={item.hint}
          >
            {loading && scenario === item.id ? <Spinner className="h-3.5 w-3.5" /> : null}
            {item.label}
          </button>
        ))}
        {result ? (
          <span className="ml-auto text-[11px] text-muted">
            BTC {fmtUsd(result.startPrice)} → {fmtUsd(result.endPrice)}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          {error}
        </div>
      ) : null}

      {!result ? (
        <div className="mt-5 flex h-[300px] items-center justify-center rounded-xl border border-line/60 bg-ink/40">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-muted">
              <Spinner /> Loading live position…
            </div>
          ) : (
            <p className="text-sm text-muted">Run a scenario to see the agent defend the loan.</p>
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
              "mt-4 flex items-start gap-3 rounded-xl border px-4 py-3",
              result.summary.agentLiquidated
                ? "border-accent/35 bg-accent/5"
                : result.summary.baselineLiquidated
                  ? "border-mint/30 bg-mint/5"
                  : "border-line bg-white/5",
            )}
          >
            <span className="mt-0.5 text-lg">
              {result.summary.agentLiquidated ? "⚠" : result.summary.baselineLiquidated ? "🛡" : "◎"}
            </span>
            <div className="text-sm">
              <p className="font-medium text-white">
                {result.summary.agentLiquidated
                  ? "Safety funds were not enough"
                  : result.summary.baselineLiquidated
                    ? "The agent saved the loan"
                    : "The loan survives either way"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
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
    tone === "good" ? "text-mint" : tone === "danger" ? "text-accent" : "text-white";
  return (
    <div className="rounded-xl border border-line/70 bg-ink/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={cls("mt-1 text-base font-semibold tracking-tight", color)}>{value}</p>
      {sub ? <p className="text-[10px] text-muted">{sub}</p> : null}
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
    <div className="relative mt-4 overflow-hidden rounded-xl border border-line/60 bg-gradient-to-b from-[#0b1119] to-[#070a0f]">
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] uppercase tracking-[0.16em] text-muted">
        <span>Collateral ratio (ICR)</span>
        <span className="text-white">
          {current ? `${fmtPct(current.icr)} · ${fmtUsd(current.price)} BTC` : "—"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ICR chart">
        <defs>
          <linearGradient id="agentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff2d55" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ff2d55" stopOpacity="0" />
          </linearGradient>
        </defs>

        {grid.map((value) => (
          <g key={value}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(value)}
              y2={y(value)}
              stroke="#1b2431"
              strokeWidth="1"
              strokeDasharray={value === 110 ? "4 4" : undefined}
            />
            <text x={8} y={y(value) + 3} fill={value === 110 ? "#ff8a3d" : "#5b6675"} fontSize="9">
              {value.toFixed(0)}%
            </text>
          </g>
        ))}

        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={y(110)}
          y2={y(110)}
          stroke="#ff8a3d"
          strokeWidth="1.4"
          strokeDasharray="5 5"
          opacity="0.8"
        />
        <text x={W - pad.r - 78} y={y(110) - 6} fill="#ff8a3d" fontSize="9">
          liquidation 110%
        </text>

        {area ? <path d={area} fill="url(#agentFill)" /> : null}

        {baseline.length > 1 ? (
          <path
            d={line(baseline)}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        ) : null}

        {agent.length > 1 ? (
          <path
            d={line(agent)}
            fill="none"
            stroke="#ff2d55"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {agent.map((step, index) => {
          if (step.action === "hold") return null;
          const color = step.action === "liquidated" ? "#ff2d55" : step.action === "repay" ? "#ff8a3d" : "#3ddc97";
          return (
            <g key={`${step.t}-${step.action}`}>
              <circle cx={x(index)} cy={y(step.icr)} r="5.5" fill="#05070a" stroke={color} strokeWidth="2.5" />
              <circle cx={x(index)} cy={y(step.icr)} r="2" fill={color} />
            </g>
          );
        })}

        {current ? (
          <g>
            <circle cx={x(agent.length - 1)} cy={y(current.icr)} r="9" fill="#ff2d55" opacity="0.15" />
            <circle cx={x(agent.length - 1)} cy={y(current.icr)} r="4" fill="#ff2d55" />
          </g>
        ) : null}

        <text x={pad.l} y={H - 10} fill="#5b6675" fontSize="9">
          start
        </text>
        <text x={W - pad.r - 22} y={H - 10} fill="#5b6675" fontSize="9">
          end
        </text>
        {!done ? (
          <text x={W / 2 - 28} y={pad.t + 4} fill="#8492a6" fontSize="9">
            replaying…
          </text>
        ) : null}
      </svg>
      <div className="flex items-center gap-4 border-t border-line/60 px-4 py-2 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-accent" /> with agent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t border-dashed border-[#64748b]" /> without agent
        </span>
        <span className="ml-auto">green dot = top-up · orange dot = repay</span>
      </div>
    </div>
  );
}

function ActionLog({ steps }: { steps: SimStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="mt-4 text-xs text-muted">
        No agent action was needed in this path. Lower the trigger LTV to make the agent act earlier.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-1.5">
      {steps.slice(0, 4).map((step) => (
        <div
          key={`${step.t}-${step.action}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-ink/40 px-3 py-2 text-[11px]"
        >
          <span className="text-muted">
            step {step.t} · BTC {fmtUsd(step.price)}
          </span>
          <span className="text-white">
            {step.action === "topUp"
              ? `top up ${fmtNum(step.topUp, 4)} BTC`
              : step.action === "repay"
                ? `repay ${fmtNum(step.repay, 0)} MUSD`
                : `top up ${fmtNum(step.topUp, 4)} BTC + repay ${fmtNum(step.repay, 0)} MUSD`}
          </span>
          <span className="text-mint">ICR {fmtPct(step.icr)}</span>
        </div>
      ))}
    </div>
  );
}
