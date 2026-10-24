"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type MarketState } from "@/lib/api";
import { cls, fmtPct, fmtUsd } from "@/lib/format";
import { Card, SectionTitle, Spinner } from "./ui";

const MOVES = [
  { label: "−10%", body: { changePct: -10 } },
  { label: "−25%", body: { changePct: -25 } },
  { label: "−40%", body: { changePct: -40 } },
  { label: "+15%", body: { changePct: 15 } },
];

/**
 * Demo network only: moves the mock BTC oracle so the agent can be watched
 * defending a real on-chain position.
 */
export function MarketCard({
  onRefresh,
  notify,
}: {
  onRefresh: () => void;
  notify: (message: string, kind?: "ok" | "err") => void;
}) {
  const [market, setMarket] = useState<MarketState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMarket(await api.demoMarket());
    } catch {
      setMarket(null);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const move = async (label: string, body: { price?: number; changePct?: number; reset?: boolean }) => {
    setBusy(label);
    try {
      const next = await api.demoPrice(body);
      setMarket(next);
      notify(`BTC is now ${fmtUsd(next.price)}. The agent reacts within seconds.`);
      setTimeout(onRefresh, 1500);
      setTimeout(onRefresh, 5000);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not move the price", "err");
    } finally {
      setBusy(null);
    }
  };

  const change = market ? ((market.price - market.startPrice) / market.startPrice) * 100 : 0;

  return (
    <Card className="border-0 bg-forest p-6 text-paper shadow-none">
      <SectionTitle
        title="Market control"
        subtitle="Demo network: move the BTC oracle and watch the agent react on-chain."
        action={<span className="badge bg-lime text-forest">Demo only</span>}
        inverted
      />

      <div className="flex items-end justify-between rounded-panel bg-paper/10 px-5 py-4">
        <div>
          <p className="text-[13px] font-medium text-paper/70">BTC price (oracle)</p>
          <p className="text-[34px] font-black leading-none tracking-[-0.04em] text-lime">
            {market ? fmtUsd(market.price) : "—"}
          </p>
        </div>
        {market ? (
          <p className={cls("text-[16px] font-bold", change < 0 ? "text-[#ffb4b8]" : "text-lime")}>
            {change >= 0 ? "+" : ""}
            {fmtPct(change)}
            <span className="block text-right text-[12px] font-medium text-paper/60">
              vs {fmtUsd(market.startPrice)}
            </span>
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {MOVES.map((move_) => (
          <button
            key={move_.label}
            className="rounded-full bg-lime px-3 py-2.5 text-[14px] font-bold text-forest transition hover:bg-[#b4f08e] disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => void move(move_.label, move_.body)}
          >
            {busy === move_.label ? <Spinner className="h-3.5 w-3.5" /> : move_.label}
          </button>
        ))}
      </div>
      <button
        className="mt-2 w-full rounded-full border border-paper/40 px-3 py-2.5 text-[14px] font-semibold text-paper transition hover:bg-paper/10 disabled:opacity-50"
        disabled={busy !== null}
        onClick={() => void move("reset", { reset: true })}
      >
        {busy === "reset" ? "Resetting…" : "Reset to starting price"}
      </button>
    </Card>
  );
}
