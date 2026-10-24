"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type AgentEvent, type HistoryPoint, type PositionView } from "@/lib/api";
import { fmtPct, fmtUsd } from "@/lib/format";
import { Card, SectionTitle } from "./ui";

const W = 760;
const H = 260;
const pad = { l: 46, r: 16, t: 16, b: 28 };

function clock(t: number) {
  return new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/** Live collateral-ratio history with the agent's actions marked on it. */
export function HistoryChart({
  vault,
  position,
  events,
}: {
  vault: string;
  position: PositionView;
  events: AgentEvent[];
}) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { points: next } = await api.history(vault);
        if (alive) {
          // Points from before a loan existed have no ratio to plot.
          setPoints(next.filter((p) => p.icr > 0));
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    void load();
    const id = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [vault]);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const icrs = points.map((p) => p.icr).filter((v) => v > 0);
    const maxICR = Math.max(position.targetICR * 1.15, ...icrs, 200);
    const minICR = Math.min(105, ...icrs);
    const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
    const y = (icr: number) =>
      pad.t + ((maxICR - Math.min(maxICR, Math.max(minICR, icr))) / (maxICR - minICR)) * (H - pad.t - pad.b);
    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.icr).toFixed(1)}`)
      .join(" ");
    const area = `${line} L${x(t1).toFixed(1)},${H - pad.b} L${x(t0).toFixed(1)},${H - pad.b} Z`;
    return { t0, t1, maxICR, minICR, x, y, line, area };
  }, [points, position.targetICR]);

  const actions = useMemo(() => {
    if (!geometry) return [];
    return events.filter((e) => e.type === "execution" && e.at >= geometry.t0 && e.at <= geometry.t1);
  }, [events, geometry]);

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !geometry) return;
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const t = geometry.t0 + ((px - pad.l) / (W - pad.l - pad.r)) * (geometry.t1 - geometry.t0);
    let best = 0;
    for (let i = 1; i < points.length; i += 1) {
      if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    }
    setHover(best);
  };

  const active = hover !== null ? points[hover] : points[points.length - 1];

  return (
    <Card className="h-full">
      <SectionTitle
        title="Health history"
        subtitle="Collateral ratio over time, with every agent action marked."
        action={
          active ? (
            <div className="text-right">
              <p className="text-[20px] font-black tracking-tight text-forest">{fmtPct(active.icr)}</p>
              <p className="text-[12px] text-slate">
                {fmtUsd(active.price)} BTC · {clock(active.t)}
              </p>
            </div>
          ) : null
        }
      />

      {!geometry ? (
        <div className="flex h-[240px] items-center justify-center rounded-panel bg-fog/60 px-6 text-center text-[14px] text-slate">
          {failed
            ? "History needs the agent service. Start the agent to record this vault's health."
            : "Collecting data… the agent records a point every few seconds while it watches this vault."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-panel bg-paper shadow-subtle">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label="Collateral ratio history"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <path d={geometry.area} fill="#e2f6d5" fillOpacity="0.85" />
            {[position.targetICR, position.triggerICR, 110].map((value, index) => (
              <g key={`${value}-${index}`}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={geometry.y(value)}
                  y2={geometry.y(value)}
                  stroke={index === 2 ? "#cb272f" : index === 1 ? "#a05a00" : "#868685"}
                  strokeDasharray="5 5"
                  strokeWidth="1.4"
                />
                <text
                  x={8}
                  y={geometry.y(value) + 4}
                  fontSize="11"
                  fontWeight="600"
                  fill={index === 2 ? "#cb272f" : index === 1 ? "#a05a00" : "#6a6c6a"}
                >
                  {value.toFixed(0)}%
                </text>
              </g>
            ))}
            <path
              d={geometry.line}
              fill="none"
              stroke="#163300"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {actions.map((event) => {
              const nearest = points.reduce((best, p) =>
                Math.abs(p.t - event.at) < Math.abs(best.t - event.at) ? p : best,
              );
              return (
                <g key={event.id}>
                  <circle cx={geometry.x(event.at)} cy={geometry.y(nearest.icr)} r="7" fill="#9fe870" stroke="#163300" strokeWidth="2.5" />
                </g>
              );
            })}
            {active ? (
              <g>
                <line
                  x1={geometry.x(active.t)}
                  x2={geometry.x(active.t)}
                  y1={pad.t}
                  y2={H - pad.b}
                  stroke="#163300"
                  strokeOpacity="0.25"
                />
                <circle cx={geometry.x(active.t)} cy={geometry.y(active.icr)} r="5" fill="#163300" />
              </g>
            ) : null}
            <text x={pad.l} y={H - 8} fontSize="11" fill="#868685">
              {clock(geometry.t0)}
            </text>
            <text x={W - pad.r - 40} y={H - 8} fontSize="11" fill="#868685">
              {clock(geometry.t1)}
            </text>
          </svg>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-5 py-2.5 text-[12px] text-slate">
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-5 rounded-full bg-forest" /> ICR
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-forest bg-lime" /> agent action
            </span>
            <span className="ml-auto">dashed: restore target · trigger · liquidation</span>
          </div>
        </div>
      )}
    </Card>
  );
}
