"use client";

import { useState } from "react";
import { vaultAbi } from "@agentvault/shared";
import { parseEther, type Address, type Hash } from "viem";
import type { PositionView } from "@/lib/api";
import { cls, fmtNum } from "@/lib/format";
import type { useWallet } from "@/lib/useWallet";
import { Badge, Card, SectionTitle, Stat } from "./ui";

type ConnectedClient = NonNullable<ReturnType<ReturnType<typeof useWallet>["getClient"]>>;
type RunTx = (label: string, fn: (client: ConnectedClient) => Promise<Hash>) => Promise<boolean>;

/**
 * Wave 2: the MUSD reserve works while it waits.
 *
 * Idle MUSD sits in the Mezo Stability Pool and earns BTC from liquidations.
 * The agent pulls it back out to repay when the loan is in danger, and
 * harvests the BTC gains straight into the loan as extra collateral.
 */
export function EarnCard({
  vault,
  position,
  isOwner,
  runTx,
  notify,
}: {
  vault: Address;
  position: PositionView;
  isOwner: boolean;
  runTx: RunTx;
  notify: (message: string, kind?: "ok" | "err") => void;
}) {
  const [amount, setAmount] = useState("");
  const e = position.earn;

  if (!position.v2 || !e) {
    return (
      <Card id="earn">
        <SectionTitle
          title="Earn"
          subtitle="This vault was created in Wave 1. Create a new vault to let the MUSD reserve earn in the Mezo Stability Pool."
        />
      </Card>
    );
  }

  const liquid = position.musdReserve;
  const pooledPct = e.totalReserve > 0 ? (e.pooledMusd / e.totalReserve) * 100 : 0;
  const floor2 = (v: number) => Math.floor(v * 100) / 100;

  const deposit = () => {
    const value = Number(amount || liquid);
    if (!Number.isFinite(value) || value <= 0) return notify("Nothing liquid to deposit", "err");
    const v = Math.min(value, liquid);
    void runTx(`Moved ${fmtNum(v, 2)} MUSD into the Stability Pool`, (client) =>
      client.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "earnDeposit",
        args: [parseEther(String(floor2(v)))],
      }),
    );
  };

  const withdraw = () => {
    const value = Number(amount || e.pooledMusd);
    if (!Number.isFinite(value) || value <= 0) return notify("Nothing in the pool", "err");
    void runTx(`Brought ${fmtNum(value, 2)} MUSD back to the vault`, (client) =>
      client.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "earnWithdraw",
        args: [parseEther(String(value))],
      }),
    );
  };

  const harvest = () =>
    void runTx("Harvested Stability Pool BTC into the loan", (client) =>
      client.writeContract({ address: vault, abi: vaultAbi, functionName: "harvest" }),
    );

  const claim = () =>
    void runTx("Claimed surplus BTC to your wallet", (client) =>
      client.writeContract({ address: vault, abi: vaultAbi, functionName: "claimSurplus" }),
    );

  return (
    <Card id="earn">
      <SectionTitle
        title="Earn"
        subtitle="Idle MUSD reserve earns BTC in the Mezo Stability Pool. The agent pulls it back to repay when your loan needs it."
        action={<Badge tone="good">Wave 2</Badge>}
      />

      {position.redeemed ? (
        <div className="mb-4 rounded-panel border border-[#f3dcae] bg-[#fdf0d5] px-4 py-3 text-[14px] text-warn">
          <p className="font-semibold">Your loan was redeemed.</p>
          <p className="mt-1">
            Mezo kept your leftover BTC in its surplus pool. The agent claims it for you automatically, or
            you can claim it now.
          </p>
          {isOwner ? (
            <button className="btn btn-primary mt-3 text-[13px]" onClick={claim}>
              Claim surplus BTC
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4">
        <div className="mb-1.5 flex justify-between text-[13px] text-slate">
          <span>Reserve {fmtNum(e.totalReserve, 0)} MUSD</span>
          <span>{fmtNum(pooledPct, 0)}% earning</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-fog" aria-hidden>
          <div className="bg-good" style={{ width: `${pooledPct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[12px] text-slate">
          <span>{fmtNum(e.pooledMusd, 0)} in Stability Pool</span>
          <span>{fmtNum(liquid, 0)} liquid for instant repay</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="BTC earned" value={`${fmtNum(e.earnedBtc, 6)}`} sub="lifetime, from liquidations" />
        <Stat
          label="Ready to harvest"
          value={`${fmtNum(e.pendingBtcGain, 6)}`}
          sub="BTC, goes into your loan"
        />
        <Stat
          label="Repay limit"
          value={e.repayCap === null ? "n/a" : `${fmtNum(e.repayCap, 0)}`}
          sub="MUSD, keeps Mezo min debt"
        />
        <Stat
          label="Fees"
          value={`${e.protectFeePct}% / ${e.performanceFeePct}%`}
          sub="per rescue / of pool gains"
        />
      </div>

      {e.surplusClaimed > 0 ? (
        <p className="mt-3 text-[13px] text-good">
          Recovered {fmtNum(e.surplusClaimed, 6)} BTC of redemption surplus for you.
        </p>
      ) : null}

      {isOwner && position.status === 1 ? (
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              className="input"
              inputMode="decimal"
              placeholder={`MUSD (liquid ${fmtNum(liquid, 0)})`}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <button className="btn btn-primary shrink-0 px-3 text-[13px]" onClick={deposit} disabled={liquid <= 0}>
              Earn
            </button>
            <button
              className="btn btn-ghost shrink-0 px-3 text-[13px]"
              onClick={withdraw}
              disabled={e.pooledMusd <= 0}
            >
              Withdraw
            </button>
          </div>
          <button
            className={cls("btn btn-ghost w-full text-[13px]")}
            onClick={harvest}
            disabled={e.pendingBtcGain <= 0}
          >
            Harvest BTC gains into my loan
          </button>
          <p className="text-[12px] leading-relaxed text-slate">
            The agent keeps part of the reserve liquid and moves the rest into the pool on its own. Mezo
            blocks pool withdrawals while any loan sits under 110%, so the liquid share and your BTC buffer
            cover that moment.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
