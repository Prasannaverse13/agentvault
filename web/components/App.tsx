"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { factoryAbi, FACTORY_ADDRESS } from "@agentvault/shared";
import type { Address } from "viem";
import { IS_DEMO, mezo, publicClient } from "@/lib/chain";
import {
  api,
  type AgentConfig,
  type AgentHealth,
  type StatusResponse,
} from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { readVaultOnChain } from "@/lib/onchain";
import { CreateVault } from "./CreateVault";
import { Dashboard } from "./Dashboard";
import { Header } from "./Header";
import { Landing } from "./Landing";
import { Card, Spinner, Toast } from "./ui";

// One saved vault per network, so a demo-chain vault never leaks into testnet.
const STORAGE_KEY = `agentvault:vault:${mezo.id}`;
const LEGACY_KEY = "agentvault:vault";

type Screen = "landing" | "app";

export default function App() {
  const wallet = useWallet();
  const [screen, setScreen] = useState<Screen>("landing");
  const [vault, setVault] = useState<Address>();
  const [vaults, setVaults] = useState<Address[]>([]);
  const [fundsKey, setFundsKey] = useState(0);
  const seenEvents = useRef<{ vault: string; ids: Set<string> } | null>(null);
  const autoFunded = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentHealth | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [liveSource, setLiveSource] = useState<"agent" | "onchain">("agent");
  const [createOpen, setCreateOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [wantApp, setWantApp] = useState(false);
  const [metaTried, setMetaTried] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, kind: "ok" | "err" = "ok") => {
    setToast({ message, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const health = await api.health();
      setAgent(health);
      setAgentOnline(true);
      const cfg = await api.config();
      setConfig(cfg);
    } catch {
      setAgentOnline(false);
    } finally {
      setMetaTried(true);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!vault) return;
    try {
      const next = await api.status(vault);
      setStatus(next);
      setStatusError(null);
      setLiveSource("agent");

      // Surface what the agent did while the owner was looking elsewhere.
      const seen = seenEvents.current;
      if (!seen || seen.vault !== vault) {
        seenEvents.current = { vault, ids: new Set(next.events.map((e) => e.id)) };
      } else {
        for (const event of [...next.events].reverse()) {
          if (seen.ids.has(event.id)) continue;
          seen.ids.add(event.id);
          if (event.type === "execution") {
            notify(`Agent protected your loan: ${event.detail ?? event.title}`);
          } else if (event.type === "alert") {
            notify(event.title, "err");
          }
        }
      }
    } catch (error) {
      // The agent service is unreachable: fall back to reading the vault
      // directly from the chain so the dashboard still tells the truth.
      try {
        const next = await readVaultOnChain(vault);
        setStatus(next);
        setStatusError(null);
        setLiveSource("onchain");
      } catch {
        setStatusError(error instanceof Error ? error.message : "Could not reach the agent");
        setLiveSource("agent");
      }
    }
  }, [vault, notify]);

  useEffect(() => {
    const stored =
      window.localStorage.getItem(STORAGE_KEY) ??
      (mezo.id === 31611 ? window.localStorage.getItem(LEGACY_KEY) : null);
    if (stored?.startsWith("0x")) {
      setVault(stored as Address);
      setScreen("app");
    }
    void loadMeta();
    const id = setInterval(() => void loadMeta(), 25_000);
    return () => clearInterval(id);
  }, [loadMeta]);

  useEffect(() => {
    if (!vault) return;
    void refreshStatus();
    const id = setInterval(() => void refreshStatus(), 8000);
    return () => clearInterval(id);
  }, [vault, refreshStatus]);

  useEffect(() => {
    if (!wantApp) return;
    if (!wallet.address) return;

    // The wallet is connected: always land on the dashboard, then fill it in.
    setScreen("app");

    if (vault) {
      setWantApp(false);
      return;
    }

    if (!metaTried) return;

    if (!config?.factory) {
      setWantApp(false);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const vaults = await publicClient.readContract({
          address: config.factory as Address,
          abi: factoryAbi,
          functionName: "getVaults",
          args: [wallet.address as Address],
        });
        if (!alive) return;
        if (vaults.length > 0) {
          const last = vaults[vaults.length - 1] as Address;
          setVault(last);
          window.localStorage.setItem(STORAGE_KEY, last);
          setScreen("app");
        } else {
          setCreateOpen(true);
        }
      } catch {
        if (alive) setCreateOpen(true);
      } finally {
        if (alive) setWantApp(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [wantApp, wallet.address, config?.factory, vault, metaTried]);

  const factoryAddress = (config?.factory ?? (FACTORY_ADDRESS || null)) as Address | null;

  const loadVaults = useCallback(async () => {
    if (!wallet.address || !factoryAddress) {
      setVaults([]);
      return;
    }
    try {
      const list = await publicClient.readContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "getVaults",
        args: [wallet.address as Address],
      });
      setVaults([...list] as Address[]);
    } catch {
      setVaults([]);
    }
  }, [wallet.address, factoryAddress]);

  useEffect(() => {
    void loadVaults();
  }, [loadVaults]);

  const getDemoFunds = useCallback(async () => {
    if (!wallet.address) return;
    try {
      const result = await api.demoFaucet(wallet.address, 100);
      notify(`Sent 100 demo BTC to your wallet (balance ${result.balance.toFixed(0)} BTC)`);
      setFundsKey((value) => value + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Demo faucet failed", "err");
    }
  }, [wallet.address, notify]);

  // Demo network: a wallet with no BTC cannot do anything, so fund it once on connect.
  useEffect(() => {
    if (!IS_DEMO || !agentOnline || !wallet.address) return;
    const address = wallet.address;
    if (autoFunded.current.has(address)) return;
    autoFunded.current.add(address);
    void (async () => {
      try {
        const balance = await publicClient.getBalance({ address });
        if (balance < 10n ** 18n) await getDemoFunds();
      } catch {
        // chain not reachable yet
      }
    })();
  }, [agentOnline, wallet.address, getDemoFunds]);

  const selectVault = (next: Address) => {
    setVault(next);
    setStatus(null);
    setStatusError(null);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const forgetVault = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
    setVault(undefined);
    setStatus(null);
    setStatusError(null);
  };

  const enterApp = () => {
    setWantApp(true);
    if (!wallet.address && !wallet.connecting) void wallet.connect();
  };

  const startCreate = () => {
    if (!wallet.address) {
      void wallet.connect();
      return;
    }
    setCreateOpen(true);
  };

  const handleCreated = (created: Address) => {
    setVault(created);
    setScreen("app");
    window.localStorage.setItem(STORAGE_KEY, created);
    setStatus(null);
    void loadVaults();
    setTimeout(() => void refreshStatus(), 2500);
    setTimeout(() => void refreshStatus(), 8000);
  };

  const openCreate = () => setCreateOpen(true);

  return (
    <div className="min-h-screen">
      <Header
        wallet={wallet}
        agentOnline={agentOnline}
        onNewVault={openCreate}
        onHome={() => setScreen("landing")}
        showNewVault={screen === "app"}
        showNav={screen === "app" && Boolean(vault)}
        onGetFunds={getDemoFunds}
        refreshKey={fundsKey}
      />

      {screen === "landing" ? (
        <Landing wallet={wallet} agentOnline={agentOnline} onCreate={enterApp} />
      ) : !vault ? (
        <NoVault
          wallet={wallet}
          factoryReady={Boolean(config?.factory)}
          onCreate={startCreate}
          onHome={() => setScreen("landing")}
        />
      ) : status ? (
        <Dashboard
          vault={vault as Address}
          status={status}
          wallet={wallet}
          agentOnline={agentOnline}
          liveSource={liveSource}
          agent={agent}
          vaults={vaults}
          onSelectVault={selectVault}
          onRefresh={() => void refreshStatus()}
          onNewVault={openCreate}
          onOpenLoan={() => setLoanOpen(true)}
          notify={notify}
        />
      ) : (
        <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 sm:px-6">
          <Card className="w-full p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mist text-forest">
              <Spinner />
            </div>
            <p className="heading mt-5 text-[24px]">
              {statusError ? "Could not load your vault" : "Loading your vault…"}
            </p>
            <p className="mt-2 text-[15px] text-slate">
              {statusError ?? "Reading the trove, oracle price and agent state from Mezo."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" onClick={() => void refreshStatus()}>
                Retry
              </button>
              <button className="btn" onClick={() => setScreen("landing")}>
                Back to home
              </button>
              <button className="btn btn-ghost" onClick={openCreate}>
                New vault
              </button>
              <button className="btn btn-ghost" onClick={forgetVault}>
                Forget this vault
              </button>
            </div>
            {statusError ? (
              <p className="mt-4 text-[14px] text-slate">
                Is the agent running? Start it with{" "}
                <code className="rounded-card bg-fog px-1.5 py-0.5 font-mono text-[14px] text-obsidian">
                  pnpm --filter @agentvault/agent dev
                </code>
              </p>
            ) : null}
          </Card>
        </main>
      )}

      <CreateVault
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        wallet={wallet}
        config={config}
        agent={agent}
        onCreated={handleCreated}
        notify={notify}
      />
      <CreateVault
        open={loanOpen}
        onClose={() => setLoanOpen(false)}
        wallet={wallet}
        config={config}
        agent={agent}
        existingVault={vault}
        onCreated={handleCreated}
        notify={notify}
      />
      <Toast toast={toast} />
    </div>
  );
}

function NoVault({
  wallet,
  factoryReady,
  onCreate,
  onHome,
}: {
  wallet: ReturnType<typeof useWallet>;
  factoryReady: boolean;
  onCreate: () => void;
  onHome: () => void;
}) {
  return (
    <main className="mx-auto max-w-page px-4 pb-24 pt-8 sm:px-6">
      <h1 className="display text-[48px] sm:text-[72px]">Your vault</h1>
      <Card className="mt-8 max-w-2xl p-8 sm:p-10">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mist text-forest">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M12 2.5 20 6v6.2c0 4.5-3.2 8.2-8 9.3-4.8-1.1-8-4.8-8-9.3V6l8-3.5Z" />
          </svg>
        </span>
        <h2 className="heading mt-6 text-[28px]">No vault on this wallet yet</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-slate">
          Create a vault to put the guardian agent on a Bitcoin-backed MUSD loan. It takes three
          short steps: create the vault, open the loan, then add safety funds.
        </p>
        {!factoryReady ? (
          <p className="mt-4 rounded-card bg-[#fdf0d5] px-4 py-3 text-[14px] font-medium text-warn">
            The agent is not reachable, so vault creation is unavailable. Start it with{" "}
            <code className="font-mono">pnpm --filter @agentvault/agent dev</code>.
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <button className="btn btn-primary px-7 py-3.5 text-[16px]" onClick={onCreate} disabled={!factoryReady}>
            {wallet.address ? "Create my vault" : "Connect wallet"}
          </button>
          <button className="link text-[16px]" onClick={onHome}>
            Back to home
          </button>
        </div>
      </Card>
    </main>
  );
}
