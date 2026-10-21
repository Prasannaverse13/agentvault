"use client";

import type { useWallet } from "@/lib/useWallet";
import { fmtNum } from "@/lib/format";
import { Simulator } from "./Simulator";
import { Badge, Card } from "./ui";

type Wallet = ReturnType<typeof useWallet>;

export function Landing({
  wallet,
  agentOnline,
  onCreate,
}: {
  wallet: Wallet;
  agentOnline: boolean;
  onCreate: () => void;
}) {
  return (
    <main className="mx-auto max-w-7xl px-5 pb-20">
      <section className="grid gap-10 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-20">
        <div className="animate-fade-up">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Mezo Buildathon · DeFi</Badge>
            <Badge>
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              MUSD on Mezo testnet
            </Badge>
            <Badge tone={agentOnline ? "good" : "warn"}>
              Agent {agentOnline ? "online" : "offline"}
            </Badge>
          </div>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your BTC loan
            <br />
            should never
            <br />
            <span className="bg-gradient-to-r from-accent via-[#ff5d7c] to-ember bg-clip-text text-transparent">
              surprise you.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            AgentVault is an autonomous risk agent for Bitcoin-backed MUSD loans on Mezo. It
            watches your collateral ratio around the clock, tops up BTC or repays debt before
            liquidation, and shows you every decision before it acts.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={wallet.address ? onCreate : wallet.connect}>
              {wallet.address ? "Open a vault" : "Connect wallet"}
            </button>
            <a className="btn btn-ghost" href="#simulate">
              Watch the crash demo ↓
            </a>
          </div>

          {wallet.error ? (
            <p className="mt-3 text-xs text-accent">{wallet.error}</p>
          ) : null}

          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["110%", "Liquidation ICR"],
              ["24/7", "Agent coverage"],
              ["0", "Withdrawal rights for the agent"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-line/70 bg-panel/60 px-3 py-3">
                <p className="text-lg font-semibold tracking-tight text-white">{value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up lg:pl-4" style={{ animationDelay: "120ms" }}>
          <GuardianCard />
        </div>
      </section>

      <section className="mt-16">
        <Simulator mode="demo" />
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          {
            step: "01",
            title: "Watch",
            body: "The agent reads your Mezo trove, the on-chain BTC price, and your safety funds every few seconds.",
          },
          {
            step: "02",
            title: "Decide",
            body: "Your rules define the trigger and the target. The agent computes the exact BTC top-up and MUSD repayment.",
          },
          {
            step: "03",
            title: "Act",
            body: "Before ICR reaches 110%, it tops up collateral or repays debt on-chain. You get a Telegram alert with the tx.",
          },
        ].map((item) => (
          <Card key={item.step} className="relative overflow-hidden">
            <span className="font-mono text-[11px] text-accent">{item.step}</span>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-accent/5 blur-2xl" />
          </Card>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="border-mint/20 bg-mint/[0.03]">
          <h3 className="text-sm font-semibold text-white">The agent can defend, never drain.</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The vault gives the agent exactly two powers: add collateral and repay debt. It cannot
            withdraw BTC, move MUSD out, or change your rules. The owner keeps a kill switch on
            every action.
          </p>
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Built on</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>Mezo</Badge>
            <Badge>MUSD</Badge>
            <Badge>BTC</Badge>
            <Badge>Solidity</Badge>
            <Badge>TypeScript</Badge>
            <Badge>Telegram</Badge>
          </div>
          <p className="mt-3 text-xs text-muted">
            Contracts on Mezo testnet · live oracle reads · {agentOnline ? "agent connected" : "agent offline"}.
          </p>
        </Card>
      </section>

      <footer className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-line/60 pt-6 text-xs text-muted sm:flex-row">
        <p>AgentVault · Built for the Mezo Buildathon, Wave 1.</p>
        <p className="font-mono text-[10px]">
          MUSD {fmtNum(1, 0)} · BTC collateral · testnet only
        </p>
      </footer>
    </main>
  );
}

function GuardianCard() {
  const rows = [
    { label: "BTC price", value: "$82,764", delta: "live oracle" },
    { label: "Your ICR", value: "182.4%", delta: "LTV 54.8%" },
    { label: "Trigger", value: "166.7%", delta: "LTV 60%" },
    { label: "Safety buffer", value: "0.20 BTC", delta: "+ 5,000 MUSD" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[32px] bg-accent/10 blur-3xl" />
      <Card className="relative overflow-hidden border-white/10 bg-[#080c12]/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint/10 text-sm">
              🛡
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Guardian active</p>
              <p className="text-[10px] text-muted">watching every 20 seconds</p>
            </div>
          </div>
          <Badge tone="good">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-mint" />
            Live
          </Badge>
        </div>

        <div className="mt-5 rounded-xl border border-line/70 bg-ink/50 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Collateral ratio</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-white">
                182.4<span className="text-xl text-muted">%</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Liquidation</p>
              <p className="mt-1 text-sm font-medium text-ember">$45,380</p>
            </div>
          </div>
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-line">
            <div className="absolute inset-y-0 left-0 w-[68%] rounded-full bg-gradient-to-r from-ember via-accent to-mint" />
            <div className="absolute inset-y-0 left-[30%] w-px bg-white/70" />
          </div>
          <div className="mt-2 flex justify-between text-[9px] uppercase tracking-wider text-muted">
            <span>110% liquidate</span>
            <span className="text-white">trigger 167%</span>
            <span>300%</span>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg border border-line/50 px-3 py-2 text-[11px]"
            >
              <span className="text-muted">{row.label}</span>
              <span className="text-white">
                {row.value} <span className="text-muted">· {row.delta}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-mint/25 bg-mint/5 px-3 py-3">
          <span className="mt-0.5 text-xs text-mint">●</span>
          <p className="text-[11px] leading-relaxed text-mint/90">
            If BTC drops 24%, the agent tops up 0.12 BTC and repays 1,400 MUSD. Estimated ICR after:
            201%.
          </p>
        </div>
      </Card>
    </div>
  );
}
