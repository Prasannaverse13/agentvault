"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { factoryAbi } from "@agentvault/shared";
import type { Address } from "viem";
import { publicClient } from "@/lib/chain";
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

const STORAGE_KEY = "agentvault:vault";

type Screen = "landing" | "app";

export default function App() {
  const wallet = useWallet();
  const [screen, setScreen] = useState<Screen>("landing");
  const [vault, setVault] = useState<Address>();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentHealth | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [liveSource, setLiveSource] = useState<"agent" | "onchain">("agent");
  const [createOpen, setCreateOpen] = useState(false);
  const [wantApp, setWantApp] = useState(false);
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
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!vault) return;
    try {
      const next = await api.status(vault);
      setStatus(next);
      setStatusError(null);
      setLiveSource("agent");
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
  }, [vault]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
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

    if (vault) {
      setScreen("app");
      setWantApp(false);
      return;
    }

    if (!config?.factory) {
      setCreateOpen(true);
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
  }, [wantApp, wallet.address, config?.factory, vault]);

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
        showNewVault={screen === "app"}
      />

      {screen === "landing" ? (
        <Landing wallet={wallet} agentOnline={agentOnline} onCreate={enterApp} />
      ) : status ? (
        <Dashboard
          vault={vault as Address}
          status={status}
          wallet={wallet}
          agentOnline={agentOnline}
          liveSource={liveSource}
          onRefresh={() => void refreshStatus()}
          onNewVault={openCreate}
          notify={notify}
        />
      ) : (
        <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24">
          <Card className="w-full text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-panel">
              <Spinner />
            </div>
            <p className="mt-4 text-sm font-medium text-white">
              {statusError ? "Could not load your vault" : "Loading your vault…"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {statusError ?? "Reading the trove, oracle price and agent state from Mezo."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary text-xs" onClick={() => void refreshStatus()}>
                Retry
              </button>
              <button className="btn btn-ghost text-xs" onClick={() => setScreen("landing")}>
                Back to home
              </button>
              <button className="btn btn-ghost text-xs" onClick={openCreate}>
                + New vault
              </button>
            </div>
            {statusError ? (
              <p className="mt-4 text-[10px] text-muted">
                Is the agent running? Start it with{" "}
                <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-white">
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
      <Toast toast={toast} />
    </div>
  );
}
