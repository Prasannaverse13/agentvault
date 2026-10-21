"use client";

import { useEffect, useState } from "react";
import {
  erc20Abi,
  vaultAbi,
  CORE,
} from "@agentvault/shared";
import {
  parseEther,
  type Address,
  type Hash,
} from "viem";
import { publicClient, EXPLORER, FAUCET } from "@/lib/chain";
import type { ChatResponse, PositionView, StatusResponse } from "@/lib/api";
import { api } from "@/lib/api";
import { cls, fmtNum, fmtPct, fmtUsd, shortAddr, timeAgo } from "@/lib/format";
import type { useWallet } from "@/lib/useWallet";
import { Simulator } from "./Simulator";
import {
  Badge,
  Card,
  SectionTitle,
  Spinner,
  Stat,
  Toggle,
} from "./ui";

type Wallet = ReturnType<typeof useWallet>;
type ConnectedClient = NonNullable<ReturnType<Wallet["getClient"]>>;

type Props = {
  vault: Address;
  status: StatusResponse;
  wallet: Wallet;
  agentOnline: boolean;
  liveSource?: "agent" | "onchain";
  onRefresh: () => void;
  onNewVault: () => void;
  notify: (message: string, kind?: "ok" | "err") => void;
};

function errorText(error: unknown): string {
  const e = error as { shortMessage?: string; message?: string };
  return (e?.shortMessage || e?.message || String(error)).slice(0, 180);
}

export function Dashboard({
  vault,
  status,
  wallet,
  agentOnline,
  liveSource = "agent",
  onRefresh,
  onNewVault,
  notify,
}: Props) {
  const position = status.position;
  const isOwner = wallet.address?.toLowerCase() === position.owner.toLowerCase();
  const [simRequest, setSimRequest] = useState<{ id: number; scenario: string } | null>(null);

  const runTx = async (label: string, fn: (client: ConnectedClient) => Promise<Hash>) => {
    const client = wallet.getClient();
    if (!client) {
      notify("Connect your wallet first", "err");
      return;
    }
    try {
      notify("Confirm the transaction in your wallet…");
      const hash = await fn(client);
      await publicClient.waitForTransactionReceipt({ hash });
      notify(label);
      onRefresh();
      setTimeout(onRefresh, 4000);
    } catch (error) {
      notify(errorText(error), "err");
    }
  };

  const triggerSimulation = (scenario: string) => {
    setSimRequest({ id: Date.now(), scenario });
    document.getElementById("simulate")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="mx-auto max-w-7xl px-5 pb-20 pt-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={agentOnline ? "good" : "warn"}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${agentOnline ? "animate-pulse-soft bg-mint" : "bg-ember"}`}
            />
            {agentOnline ? "Agent online" : "Agent offline"}
          </Badge>
          {liveSource === "onchain" ? (
            <Badge tone="accent">Live on-chain read</Badge>
          ) : null}
          <Badge>
            Vault <span className="font-mono text-white">{shortAddr(vault)}</span>
          </Badge>
          {isOwner ? <Badge tone="accent">Owner wallet</Badge> : <Badge tone="warn">Read only</Badge>}
          <a
            className="badge transition hover:text-white"
            href={`${EXPLORER}/address/${vault}`}
            target="_blank"
            rel="noreferrer"
          >
            Explorer ↗
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost text-xs" onClick={onRefresh}>
            Refresh
          </button>
          <button className="btn btn-ghost text-xs" onClick={onNewVault}>
            + New vault
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PositionCard position={position} />
        </div>
        <div className="lg:col-span-5">
          <AgentCard
            position={position}
            status={status}
            vault={vault}
            isOwner={isOwner}
            onRefresh={onRefresh}
            notify={notify}
          />
        </div>

        <div className="lg:col-span-7">
          <Simulator mode="live" vault={vault} position={position} request={simRequest} />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <RulesCard
            vault={vault}
            position={position}
            isOwner={isOwner}
            runTx={runTx}
            notify={notify}
          />
          <SafetyCard
            vault={vault}
            position={position}
            isOwner={isOwner}
            runTx={runTx}
            notify={notify}
          />
        </div>

        <div className="lg:col-span-7">
          <ChatCard
            vault={vault}
            isOwner={isOwner}
            runTx={runTx}
            onSimulate={triggerSimulation}
            notify={notify}
          />
        </div>
        <div className="lg:col-span-5">
          <ActivityCard events={status.events} onRefresh={onRefresh} />
        </div>
      </div>
    </main>
  );
}

function healthTone(health: PositionView["health"]): "good" | "warn" | "danger" {
  return health === "safe" ? "good" : health === "watch" ? "warn" : "danger";
}

function PositionCard({ position }: { position: PositionView }) {
  const pct = Math.max(0, Math.min(1, (position.icr - 110) / (300 - 110)));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const distance = position.price > 0 ? ((position.price - position.liquidationPrice) / position.price) * 100 : 0;

  return (
    <Card className="h-full">
      <SectionTitle
        title="Your position"
        subtitle={`MUSD borrowed against BTC · ${position.agentConnected ? "agent authorised" : "agent not authorised"}`}
        action={
          <Badge tone={healthTone(position.health)}>
            {position.health === "safe" ? "Healthy" : position.health === "watch" ? "Watch" : "Danger"}
          </Badge>
        }
      />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-[150px] w-[150px] shrink-0 sm:mx-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#1b2431" strokeWidth="10" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="url(#gauge)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${pct * circumference} ${circumference}`}
            />
            <defs>
              <linearGradient id="gauge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff8a3d" />
                <stop offset="55%" stopColor="#ff2d55" />
                <stop offset="100%" stopColor="#3ddc97" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[9px] uppercase tracking-[0.18em] text-muted">ICR</p>
            <p className="text-3xl font-semibold tracking-tight text-white">{fmtPct(position.icr)}</p>
            <p className="text-[11px] text-muted">LTV {fmtPct(position.ltv)}</p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2">
          <Stat label="Collateral" value={`${fmtNum(position.coll, 4)} BTC`} sub={fmtUsd(position.price)} />
          <Stat label="Debt" value={`${fmtNum(position.debt, 0)} MUSD`} sub="fixed-rate loan" />
          <Stat
            label="Liquidation"
            value={fmtUsd(position.liquidationPrice)}
            sub={`${fmtNum(distance, 1)}% below spot`}
          />
          <Stat
            label="Safety funds"
            value={`${fmtNum(position.btcBuffer, 3)} BTC`}
            sub={`${fmtNum(position.musdReserve, 0)} MUSD reserve`}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="badge">
          Trigger <span className="text-white">{fmtPct(position.triggerICR)}</span>
        </span>
        <span className="badge">
          Target <span className="text-white">{fmtPct(position.targetICR)}</span>
        </span>
        <span className="badge">
          BTC <span className="text-white">{fmtUsd(position.price)}</span>
        </span>
        <span className={cls("badge", position.autoProtect ? "border-mint/30 text-mint" : "border-ember/30 text-ember")}>
          {position.autoProtect ? "Protection active" : "Protection paused"}
        </span>
      </div>
    </Card>
  );
}

function AgentCard({
  position,
  status,
  vault,
  isOwner,
  onRefresh,
  notify,
}: {
  position: PositionView;
  status: StatusResponse;
  vault: Address;
  isOwner: boolean;
  onRefresh: () => void;
  notify: (message: string, kind?: "ok" | "err") => void;
}) {
  const [checking, setChecking] = useState(false);
  const decision = status.decision;
  const lastExecution = status.events.find((event) => event.type === "execution");

  const check = async () => {
    setChecking(true);
    try {
      const result = await api.check(vault);
      notify(
        result.executed
          ? `Agent protected the loan · ${result.txHash?.slice(0, 10)}…`
          : result.decision.reason,
        result.executed ? "ok" : undefined,
      );
      onRefresh();
    } catch (error) {
      notify(errorText(error), "err");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <SectionTitle
        title="Agent decision"
        subtitle={position.agentConnected ? "Live rules engine" : "Agent is not authorised on this vault"}
        action={
          <Badge tone={position.autoProtect && position.agentConnected ? "good" : "warn"}>
            {position.autoProtect ? "Armed" : "Paused"}
          </Badge>
        }
      />

      <div className="rounded-xl border border-line/70 bg-ink/40 p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Right now</p>
        <p className="mt-1.5 text-sm leading-relaxed text-white">{decision.reason}</p>
        {decision.kind !== "hold" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line/60 px-3 py-2">
              <p className="text-[10px] text-muted">Top up</p>
              <p className="text-sm font-semibold text-white">{fmtNum(decision.topUpAmount, 4)} BTC</p>
            </div>
            <div className="rounded-lg border border-line/60 px-3 py-2">
              <p className="text-[10px] text-muted">Repay</p>
              <p className="text-sm font-semibold text-white">{fmtNum(decision.repayAmount, 0)} MUSD</p>
            </div>
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
          <span>ICR now</span>
          <span className="text-white">{fmtPct(decision.icr)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
          <span>After action</span>
          <span className="text-mint">{fmtPct(decision.projectedICR)}</span>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-1.5 text-[11px]">
        <Row label="Agent wallet" value={shortAddr(position.agent)} mono />
        <Row label="Trigger" value={`${fmtPct(position.triggerICR)} ICR`} />
        <Row label="Target" value={`${fmtPct(position.targetICR)} ICR`} />
        <Row label="Buffer / reserve" value={`${fmtNum(position.btcBuffer, 3)} BTC / ${fmtNum(position.musdReserve, 0)} MUSD`} />
      </div>

      {!isOwner ? (
        <p className="mt-3 rounded-lg border border-ember/25 bg-ember/5 px-3 py-2 text-[11px] text-ember">
          Connect the owner wallet to update rules or run an agent check.
        </p>
      ) : null}

      <button
        className="btn btn-primary mt-3 w-full text-xs"
        onClick={check}
        disabled={checking || !position.agentConnected}
      >
        {checking ? <Spinner className="h-3.5 w-3.5" /> : "▸"} Run agent check now
      </button>

      {lastExecution ? (
        <p className="mt-2 text-center text-[10px] text-muted">
          Last action {timeAgo(lastExecution.at)}
          {lastExecution.txHash ? (
            <>
              {" · "}
              <a
                className="text-mint underline decoration-dotted"
                href={`${EXPLORER}/tx/${lastExecution.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                tx
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line/50 px-3 py-1.5">
      <span className="text-muted">{label}</span>
      <span className={cls("text-white", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function RulesCard({
  vault,
  position,
  isOwner,
  runTx,
  notify,
}: {
  vault: Address;
  position: PositionView;
  isOwner: boolean;
  runTx: (label: string, fn: (client: ConnectedClient) => Promise<Hash>) => Promise<void>;
  notify: (message: string, kind?: "ok" | "err") => void;
}) {
  const [triggerLTV, setTriggerLTV] = useState(Math.round(position.triggerLTV));
  const [targetLTV, setTargetLTV] = useState(Math.round(position.targetLTV));
  const [auto, setAuto] = useState(position.autoProtect);

  useEffect(() => {
    setTriggerLTV(Math.round(position.triggerLTV));
    setTargetLTV(Math.round(position.targetLTV));
    setAuto(position.autoProtect);
  }, [position.triggerLTV, position.targetLTV, position.autoProtect]);

  const triggerICR = 100 / triggerLTV;
  const targetICR = 100 / targetLTV;
  const dirty =
    Math.abs(triggerLTV - position.triggerLTV) > 0.4 ||
    Math.abs(targetLTV - position.targetLTV) > 0.4 ||
    auto !== position.autoProtect;

  const apply = () => {
    if (targetLTV > triggerLTV - 2) {
      notify("Target LTV must be at least 2 points below the trigger", "err");
      return;
    }
    void runTx("Protection rules updated", (client) =>
      client.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "setRules",
        args: [parseEther(triggerICR.toFixed(4)), parseEther(targetICR.toFixed(4)), auto],
      }),
    );
  };

  return (
    <Card id="rules">
      <SectionTitle
        title="Protection rules"
        subtitle="When ICR falls below the trigger, restore to the target."
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Auto</span>
            <Toggle checked={auto} onChange={setAuto} disabled={!isOwner} />
          </div>
        }
      />

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Trigger</span>
            <span className="font-medium text-white">
              {triggerLTV}% LTV <span className="text-muted">· {triggerICR.toFixed(0)}% ICR</span>
            </span>
          </div>
          <input
            className="mt-2 w-full"
            type="range"
            min={40}
            max={80}
            step={1}
            value={triggerLTV}
            disabled={!isOwner}
            onChange={(event) => {
              const next = Number(event.target.value);
              setTriggerLTV(next);
              if (targetLTV > next - 2) setTargetLTV(Math.max(30, next - 5));
            }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Restore to</span>
            <span className="font-medium text-white">
              {targetLTV}% LTV <span className="text-muted">· {targetICR.toFixed(0)}% ICR</span>
            </span>
          </div>
          <input
            className="mt-2 w-full"
            type="range"
            min={30}
            max={75}
            step={1}
            value={targetLTV}
            disabled={!isOwner}
            onChange={(event) => {
              const next = Number(event.target.value);
              setTargetLTV(Math.min(next, triggerLTV - 2));
            }}
          />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-line/60 bg-ink/40 px-3 py-2.5 text-[11px] text-muted">
        The agent starts defending at <span className="text-white">{triggerICR.toFixed(0)}% ICR</span> and
        restores the loan to <span className="text-white">{targetICR.toFixed(0)}% ICR</span>. Liquidation
        happens at 110%.
      </div>

      <button className="btn btn-primary mt-3 w-full text-xs" onClick={apply} disabled={!isOwner || !dirty}>
        {dirty ? "Sign rule update" : "Rules up to date"}
      </button>
      {!isOwner ? (
        <p className="mt-2 text-center text-[10px] text-muted">Owner wallet required</p>
      ) : null}
    </Card>
  );
}

type ActionTab = "buffer" | "reserve" | "borrow" | "repay";

function SafetyCard({
  vault,
  position,
  isOwner,
  runTx,
  notify,
}: {
  vault: Address;
  position: PositionView;
  isOwner: boolean;
  runTx: (label: string, fn: (client: ConnectedClient) => Promise<Hash>) => Promise<void>;
  notify: (message: string, kind?: "ok" | "err") => void;
}) {
  const [tab, setTab] = useState<ActionTab>("buffer");
  const [amount, setAmount] = useState("0.05");

  useEffect(() => {
    const defaults: Record<ActionTab, string> = {
      buffer: "0.05",
      reserve: "1000",
      borrow: "1000",
      repay: "500",
    };
    setAmount(defaults[tab]);
  }, [tab]);

  const execute = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      notify("Enter a positive amount", "err");
      return;
    }
    if (tab === "buffer") {
      void runTx(`Added ${amount} BTC to the safety buffer`, (client) =>
        client.sendTransaction({ to: vault, value: parseEther(amount) }),
      );
    }
    if (tab === "reserve") {
      const parsed = parseEther(amount);
      void runTx(`Funded ${amount} MUSD reserve`, async (client) => {
        const approve = await client.writeContract({
          address: CORE.MUSD as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, parsed],
        });
        await publicClient.waitForTransactionReceipt({ hash: approve });
        return client.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "fundReserve",
          args: [parsed],
        });
      });
    }
    if (tab === "borrow") {
      void runTx(`Borrowed ${amount} MUSD`, (client) =>
        client.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "borrowMore",
          args: [parseEther(amount)],
        }),
      );
    }
    if (tab === "repay") {
      const parsed = parseEther(amount);
      void runTx(`Repaid ${amount} MUSD`, async (client) => {
        const approve = await client.writeContract({
          address: CORE.MUSD as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, parsed],
        });
        await publicClient.waitForTransactionReceipt({ hash: approve });
        return client.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "repay",
          args: [parsed],
        });
      });
    }
  };

  const copy: Record<ActionTab, { title: string; hint: string; cta: string }> = {
    buffer: {
      title: "BTC safety buffer",
      hint: "Held in the vault. The agent spends it only to add collateral.",
      cta: "Add BTC buffer",
    },
    reserve: {
      title: "MUSD reserve",
      hint: "Held in the vault. The agent spends it only to repay debt.",
      cta: "Fund reserve",
    },
    borrow: {
      title: "Borrow more MUSD",
      hint: "Increases debt and lowers your ICR. MUSD is sent to your wallet.",
      cta: "Borrow",
    },
    repay: {
      title: "Repay debt",
      hint: "Pulls MUSD from your wallet and burns it against the loan.",
      cta: "Repay",
    },
  };

  return (
    <Card>
      <SectionTitle
        title="Actions"
        subtitle="Keep a buffer ready so the agent never has to wait for you."
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line/60 bg-ink/40 px-3 py-2">
          <p className="text-[10px] text-muted">BTC buffer</p>
          <p className="text-sm font-semibold text-white">{fmtNum(position.btcBuffer, 4)}</p>
        </div>
        <div className="rounded-lg border border-line/60 bg-ink/40 px-3 py-2">
          <p className="text-[10px] text-muted">MUSD reserve</p>
          <p className="text-sm font-semibold text-white">{fmtNum(position.musdReserve, 0)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl border border-line bg-ink/50 p-1 text-[10px]">
        {(
          [
            ["buffer", "Buffer"],
            ["reserve", "Reserve"],
            ["borrow", "Borrow"],
            ["repay", "Repay"],
          ] as [ActionTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cls(
              "rounded-lg px-1 py-1.5 transition",
              tab === id ? "bg-white/10 text-white" : "text-muted hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted">{copy[tab].hint}</p>

      <div className="mt-2 flex gap-2">
        <input
          className="input"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder={tab === "buffer" ? "BTC amount" : "MUSD amount"}
          disabled={!isOwner}
        />
        <button className="btn btn-primary shrink-0 text-xs" onClick={execute} disabled={!isOwner}>
          {copy[tab].cta}
        </button>
      </div>

      {!isOwner ? (
        <p className="mt-2 text-[10px] text-muted">
          Connect the owner wallet to move funds. Need testnet BTC?{" "}
          <a className="text-accent" href={FAUCET} target="_blank" rel="noreferrer">
            Faucet ↗
          </a>
        </p>
      ) : null}
    </Card>
  );
}

type ChatMessage = {
  role: "user" | "agent";
  text: string;
  patch?: ChatResponse["rulePatch"];
};

function ChatCard({
  vault,
  isOwner,
  runTx,
  onSimulate,
  notify,
}: {
  vault: Address;
  isOwner: boolean;
  runTx: (label: string, fn: (client: ConnectedClient) => Promise<Hash>) => Promise<void>;
  onSimulate: (scenario: string) => void;
  notify: (message: string, kind?: "ok" | "err") => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      text: "I am watching this vault. Ask me to change your protection rules, pause the agent, or stress-test a BTC crash.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const suggestions = [
    "Protect me at 60% LTV and restore to 50%",
    "Run a crash test",
    "How risky am I right now?",
  ];

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setSending(true);
    try {
      const response = await api.chat(vault, message);
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: response.reply, patch: response.rulePatch ?? undefined },
      ]);
      if (response.simulate) onSimulate(response.simulate);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "agent", text: errorText(error) }]);
    } finally {
      setSending(false);
    }
  };

  const applyPatch = (patch: ChatResponse["rulePatch"]) => {
    if (!patch) return;
    void runTx("Protection rules updated", (client) =>
      client.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "setRules",
        args: [
          parseEther(Number(patch.triggerICR).toFixed(4)),
          parseEther(Number(patch.targetICR).toFixed(4)),
          patch.autoProtect,
        ],
      }),
    );
  };

  return (
    <Card id="chat" className="flex h-[560px] flex-col">
      <SectionTitle
        title="Talk to the agent"
        subtitle="Natural-language rules. The owner wallet still signs every change."
        action={<Badge>AI + rules</Badge>}
      />

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cls("flex", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cls(
                "max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                message.role === "user"
                  ? "rounded-br-md bg-accent text-white"
                  : "rounded-bl-md border border-line bg-ink/60 text-white/90",
              )}
            >
              <p>{message.text}</p>
              {message.patch ? (
                <div className="mt-2 rounded-lg border border-mint/25 bg-mint/5 p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-mint">Proposed rules</p>
                  <p className="mt-1 text-[11px] text-white">
                    Trigger {fmtPct(Number(message.patch.triggerICR) * 100)} ICR · Target{" "}
                    {fmtPct(Number(message.patch.targetICR) * 100)} ICR ·{" "}
                    {message.patch.autoProtect ? "active" : "paused"}
                  </p>
                  <button
                    className="btn btn-primary mt-2 w-full py-1.5 text-[10px]"
                    onClick={() => applyPatch(message.patch ?? null)}
                    disabled={!isOwner}
                  >
                    Apply with wallet
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {sending ? (
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <Spinner className="h-3 w-3" /> Agent is thinking…
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted transition hover:border-white/25 hover:text-white"
            onClick={() => void send(suggestion)}
            disabled={sending}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <input
          className="input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about your loan…"
          disabled={sending}
        />
        <button className="btn btn-primary shrink-0 px-3 text-xs" type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </Card>
  );
}

function ActivityCard({
  events,
  onRefresh,
}: {
  events: StatusResponse["events"];
  onRefresh: () => void;
}) {
  const icon: Record<string, string> = {
    execution: "🛡",
    alert: "⚠",
    simulation: "📉",
    chat: "💬",
    boot: "◎",
    rules: "⚙",
    decision: "◈",
  };
  return (
    <Card className="flex h-[560px] flex-col">
      <SectionTitle
        title="Agent activity"
        subtitle="Every decision and on-chain action is logged."
        action={
          <button className="text-[10px] text-muted transition hover:text-white" onClick={onRefresh}>
            Refresh
          </button>
        }
      />
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="rounded-lg border border-line/60 bg-ink/40 px-3 py-6 text-center text-xs text-muted">
            No activity yet. Run an agent check or a simulation.
          </p>
        ) : null}
        {events.map((event) => (
          <div key={event.id} className="rounded-xl border border-line/60 bg-ink/40 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-xs">{icon[event.type] ?? "•"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-white">{event.title}</p>
                {event.detail ? (
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted">
                    {event.detail}
                  </p>
                ) : null}
                <div className="mt-1 flex items-center gap-2 text-[9.5px] text-muted">
                  <span>{timeAgo(event.at)}</span>
                  {event.txHash ? (
                    <a
                      className="text-mint underline decoration-dotted"
                      href={`${EXPLORER}/tx/${event.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {event.txHash.slice(0, 8)}…
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
