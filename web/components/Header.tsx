"use client";

import { useEffect, useState } from "react";
import { erc20Abi, CORE } from "@agentvault/shared";
import type { Address } from "viem";
import { publicClient, FAUCET } from "@/lib/chain";
import { fmtNum, shortAddr } from "@/lib/format";
import type { useWallet } from "@/lib/useWallet";
import { Badge } from "./ui";

type Wallet = ReturnType<typeof useWallet>;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-accent/40 bg-accent/10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2.5 20 6v6.2c0 4.5-3.2 8.2-8 9.3-4.8-1.1-8-4.8-8-9.3V6l8-3.5Z"
            stroke="#ff2d55"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12.8 6.5 8.5 12h2.7l-.9 5.5 4.6-6.1h-2.9l.8-4.9Z"
            fill="#ff2d55"
          />
        </svg>
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-mint glow-dot" />
      </div>
      {!compact ? (
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight text-white">AgentVault</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Mezo · MUSD</p>
        </div>
      ) : null}
    </div>
  );
}

export function Header({
  wallet,
  agentOnline,
  onNewVault,
  showNewVault,
}: {
  wallet: Wallet;
  agentOnline: boolean;
  onNewVault: () => void;
  showNewVault: boolean;
}) {
  const [btc, setBtc] = useState<number>();
  const [musd, setMusd] = useState<number>();

  useEffect(() => {
    if (!wallet.address) {
      setBtc(undefined);
      setMusd(undefined);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const [balance, musdBalance] = await Promise.all([
          publicClient.getBalance({ address: wallet.address as Address }),
          publicClient.readContract({
            address: CORE.MUSD as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [wallet.address as Address],
          }),
        ]);
        if (!alive) return;
        setBtc(Number(balance) / 1e18);
        setMusd(Number(musdBalance) / 1e18);
      } catch {
        // ignore
      }
    };
    void load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [wallet.address]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-5">
          <a href="/" className="shrink-0">
            <Logo />
          </a>
          <span className="hidden h-6 w-px bg-line md:block" />
          <div className="hidden items-center gap-4 text-xs text-muted md:flex">
            <a className="transition hover:text-white" href="#simulate">
              Simulator
            </a>
            <a className="transition hover:text-white" href="#rules">
              Rules
            </a>
            <a className="transition hover:text-white" href="#chat">
              Agent chat
            </a>
            <a
              className="transition hover:text-white"
              href={FAUCET}
              target="_blank"
              rel="noreferrer"
            >
              Faucet ↗
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Badge tone={agentOnline ? "good" : "warn"} className="hidden sm:inline-flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${agentOnline ? "bg-mint" : "bg-ember"} ${agentOnline ? "animate-pulse-soft" : ""}`}
            />
            {agentOnline ? "Agent online" : "Agent offline"}
          </Badge>

          {showNewVault ? (
            <button className="btn btn-ghost hidden text-xs sm:inline-flex" onClick={onNewVault}>
              + New vault
            </button>
          ) : null}

          {wallet.address ? (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white/5 px-3 py-2">
              <div className="hidden text-right leading-tight sm:block">
                <p className="font-mono text-[11px] text-white">{shortAddr(wallet.address)}</p>
                <p className="text-[10px] text-muted">
                  {btc === undefined ? "—" : `${fmtNum(btc, 4)} BTC`} ·{" "}
                  {musd === undefined ? "—" : `${fmtNum(musd, 0)} MUSD`}
                </p>
              </div>
              <span className="h-2 w-2 rounded-full bg-mint" />
            </div>
          ) : (
            <button className="btn btn-primary text-xs" onClick={wallet.connect} disabled={wallet.connecting}>
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
