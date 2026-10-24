"use client";

import { useEffect, useRef, useState } from "react";
import { erc20Abi, CORE } from "@agentvault/shared";
import type { Address } from "viem";
import { publicClient, addressUrl, FAUCET, IS_DEMO } from "@/lib/chain";
import { fmtNum, shortAddr } from "@/lib/format";
import { METAMASK_DOWNLOAD, type useWallet } from "@/lib/useWallet";
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
  onHome,
  showNewVault,
  showNav,
  onGetFunds,
  refreshKey,
}: {
  wallet: Wallet;
  agentOnline: boolean;
  onNewVault: () => void;
  onHome: () => void;
  showNewVault: boolean;
  showNav: boolean;
  onGetFunds: () => Promise<void>;
  refreshKey: number;
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
  }, [wallet.address, refreshKey]);

  const links: [string, string, boolean][] = [
    ["Simulator", "#simulate", false],
    ["Rules", "#rules", false],
    ["Agent chat", "#chat", false],
    ...(FAUCET ? ([["Faucet ↗", FAUCET, true]] as [string, string, boolean][]) : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-page items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <a
            href="/"
            className="shrink-0"
            onClick={(event) => {
              event.preventDefault();
              onHome();
              window.scrollTo({ top: 0 });
            }}
          >
            <Logo />
          </a>
          <nav className={showNav ? "hidden items-center gap-1 lg:flex" : "hidden"}>
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
          {IS_DEMO ? (
            <Badge tone="accent" className="hidden md:inline-flex">
              Demo network
            </Badge>
          ) : null}
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

          <WalletButton wallet={wallet} btc={btc} musd={musd} onGetFunds={onGetFunds} />
        </div>
      </div>
    </header>
  );
}

function WalletButton({
  wallet,
  btc,
  musd,
  onGetFunds,
}: {
  wallet: Wallet;
  btc?: number;
  musd?: number;
  onGetFunds: () => Promise<void>;
}) {
  const [funding, setFunding] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!wallet.address) {
    return (
      <div className="flex items-center gap-2">
        {!wallet.hasProvider ? (
          <a
            className="btn btn-primary px-4 py-2 text-[14px]"
            href={METAMASK_DOWNLOAD}
            target="_blank"
            rel="noreferrer"
          >
            Install MetaMask
          </a>
        ) : null}
        <button
          className={wallet.hasProvider ? "btn btn-primary px-4 py-2 text-[14px]" : "btn px-4 py-2 text-[14px]"}
          onClick={wallet.connect}
          disabled={wallet.connecting}
        >
          {wallet.connecting ? "Check MetaMask…" : wallet.hasProvider ? "Connect MetaMask" : "Connect wallet"}
        </button>
      </div>
    );
  }

  if (!wallet.isCorrectChain) {
    return (
      <button className="btn border-danger bg-[#fbe4e5] px-4 py-2 text-[14px] text-danger" onClick={wallet.switchNetwork}>
        Wrong network · Switch to Mezo
      </button>
    );
  }

  const address = wallet.address;
  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2.5 rounded-full bg-fog py-1.5 pl-1.5 pr-4 text-left transition hover:bg-[#dde1da]"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-black text-lime">
          {address.slice(2, 4).toUpperCase()}
        </span>
        <span className="leading-tight">
          <span className="block font-mono text-[12px] font-semibold text-forest">{shortAddr(address)}</span>
          <span className="hidden text-[11px] text-slate sm:block">
            {btc === undefined ? "—" : `${fmtNum(btc, 4)} BTC`} · {musd === undefined ? "—" : `${fmtNum(musd, 0)} MUSD`}
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-panel bg-paper p-2 shadow-xl"
        >
          <div className="px-3 py-3">
            <p className="text-[12px] font-semibold text-slate">
              {wallet.isMetaMask ? "MetaMask" : "Browser wallet"} · Mezo Testnet
            </p>
            <p className="mt-1 break-all font-mono text-[12px] text-forest">{address}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-card bg-fog/70 px-3 py-2">
                <p className="text-[11px] text-slate">BTC</p>
                <p className="text-[15px] font-bold text-obsidian">{btc === undefined ? "—" : fmtNum(btc, 4)}</p>
              </div>
              <div className="rounded-card bg-fog/70 px-3 py-2">
                <p className="text-[11px] text-slate">MUSD</p>
                <p className="text-[15px] font-bold text-obsidian">{musd === undefined ? "—" : fmtNum(musd, 0)}</p>
              </div>
            </div>
          </div>
          <MenuItem
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(address);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                // clipboard blocked
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy address"}
          </MenuItem>
          {addressUrl(address) ? (
            <MenuItem href={addressUrl(address) as string}>View on explorer ↗</MenuItem>
          ) : null}
          {IS_DEMO ? (
            <MenuItem
              onClick={async () => {
                setFunding(true);
                try {
                  await onGetFunds();
                } finally {
                  setFunding(false);
                }
              }}
            >
              {funding ? "Sending demo BTC…" : "Get 100 demo BTC"}
            </MenuItem>
          ) : (
            <MenuItem href={FAUCET}>Get testnet BTC ↗</MenuItem>
          )}
          <MenuItem
            onClick={async () => {
              if (await wallet.watchMusd()) {
                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
              }
            }}
          >
            {added ? "MUSD added ✓" : "Add MUSD to MetaMask"}
          </MenuItem>
          <MenuItem
            danger
            onClick={() => {
              setOpen(false);
              void wallet.disconnect();
            }}
          >
            Disconnect
          </MenuItem>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  href,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = `block w-full rounded-card px-3 py-2.5 text-left text-[14px] font-semibold transition hover:bg-mist ${
    danger ? "text-danger" : "text-forest"
  }`;
  return href ? (
    <a role="menuitem" className={className} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <button role="menuitem" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
