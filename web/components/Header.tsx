"use client";

import { useEffect, useState } from "react";
import { erc20Abi, CORE } from "@agentvault/shared";
import type { Address } from "viem";
import { publicClient, FAUCET } from "@/lib/chain";
import { fmtNum, shortAddr } from "@/lib/format";
import type { useWallet } from "@/lib/useWallet";
import { Badge } from "./ui";

type Wallet = ReturnType<typeof useWallet>;

export function Logo({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full ${inverted ? "bg-lime" : "bg-forest"}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2.5 20 6v6.2c0 4.5-3.2 8.2-8 9.3-4.8-1.1-8-4.8-8-9.3V6l8-3.5Z"
            fill={inverted ? "#163300" : "#9fe870"}
          />
          <path d="M12.8 6.5 8.5 12h2.7l-.9 5.5 4.6-6.1h-2.9l.8-4.9Z" fill={inverted ? "#9fe870" : "#163300"} />
        </svg>
      </div>
      {!compact ? (
        <p
          className={`text-[19px] font-black tracking-[-0.04em] ${inverted ? "text-lime" : "text-forest"}`}
        >
          AgentVault
        </p>
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

  const links: [string, string, boolean][] = [
    ["Simulator", "#simulate", false],
    ["Rules", "#rules", false],
    ["Agent chat", "#chat", false],
    ["Faucet ↗", FAUCET, true],
  ];

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-page items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <a href="/" className="shrink-0">
            <Logo />
          </a>
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map(([label, href, external]) => (
              <a
                key={label}
                className="rounded-full px-3.5 py-2 text-[15px] font-semibold text-forest transition hover:bg-mist"
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={agentOnline ? "good" : "warn"} className="hidden sm:inline-flex">
            <span
              className={`h-2 w-2 rounded-full ${agentOnline ? "animate-pulse-soft bg-good" : "bg-warn"}`}
            />
            {agentOnline ? "Agent online" : "Agent offline"}
          </Badge>

          {showNewVault ? (
            <button className="btn hidden px-4 py-2 text-[14px] sm:inline-flex" onClick={onNewVault}>
              New vault
            </button>
          ) : null}

          {wallet.address ? (
            <div className="flex items-center gap-2.5 rounded-full bg-fog py-1.5 pl-1.5 pr-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-black text-lime">
                {wallet.address.slice(2, 4).toUpperCase()}
              </span>
              <div className="leading-tight">
                <p className="font-mono text-[12px] font-semibold text-forest">{shortAddr(wallet.address)}</p>
                <p className="hidden text-[11px] text-slate sm:block">
                  {btc === undefined ? "—" : `${fmtNum(btc, 4)} BTC`} ·{" "}
                  {musd === undefined ? "—" : `${fmtNum(musd, 0)} MUSD`}
                </p>
              </div>
            </div>
          ) : (
            <button className="btn px-4 py-2 text-[14px]" onClick={wallet.connect} disabled={wallet.connecting}>
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
