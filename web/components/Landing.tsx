"use client";

import { useState } from "react";
import type { useWallet } from "@/lib/useWallet";
import { cls, fmtNum, fmtPct, fmtUsd } from "@/lib/format";
import { Logo } from "./Header";
import { Simulator } from "./Simulator";
import { Badge } from "./ui";

type Wallet = ReturnType<typeof useWallet>;

// Illustrative price for the hero calculator only; the simulator and the
// dashboard read the live Mezo oracle.
const EXAMPLE_BTC_PRICE = 82_764;
const LIQUIDATION_ICR = 1.1;

export function Landing({
  wallet,
  agentOnline,
  onCreate,
}: {
  wallet: Wallet;
  agentOnline: boolean;
  onCreate: () => void;
}) {
  const primary = wallet.address ? onCreate : wallet.connect;
  const primaryLabel = wallet.address ? "Open a vault" : "Connect wallet";

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-page px-4 pb-16 pt-8 sm:px-6 lg:pb-24 lg:pt-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-16">
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">Mezo Buildathon · DeFi</Badge>
              <Badge tone={agentOnline ? "good" : "warn"}>
                <span className={cls("h-2 w-2 rounded-full", agentOnline ? "bg-good" : "bg-warn")} />
                Agent {agentOnline ? "online" : "offline"}
              </Badge>
            </div>

            <h1 className="display mt-6 text-[48px] sm:text-[72px] lg:text-[80px] xl:text-[88px]">
              Your BTC loan should never surprise you
            </h1>

            <p className="mt-6 max-w-xl text-[18px] leading-[1.55] text-charcoal">
              AgentVault is an autonomous risk agent for Bitcoin-backed MUSD loans on Mezo. It
              watches your collateral ratio around the clock, tops up BTC or repays debt before
              liquidation, and shows you every decision before it acts.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6">
              <button className="btn btn-primary px-7 py-3.5 text-[16px]" onClick={primary}>
                {primaryLabel}
              </button>
              <a className="link text-[16px]" href="#simulate">
                Watch the crash demo
              </a>
            </div>

            {wallet.error ? <p className="mt-4 text-[14px] text-danger">{wallet.error}</p> : null}
          </div>

          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <LoanCalculator onCreate={primary} ctaLabel={wallet.address ? "Protect this loan" : primaryLabel} />
          </div>
        </div>
      </section>

      {/* Trust numbers */}
      <section className="border-y border-line">
        <div className="mx-auto grid max-w-page grid-cols-1 divide-y divide-line px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          {[
            ["110%", "Liquidation ICR on Mezo. The agent acts long before it."],
            ["24/7", "Agent coverage. It reads your trove every few seconds."],
            ["0", "Withdrawal rights for the agent. It can only defend."],
          ].map(([value, label]) => (
            <div key={value} className="px-2 py-8 sm:px-8">
              <p className="text-[56px] font-black leading-none tracking-[-0.04em] text-forest">{value}</p>
              <p className="mt-3 max-w-[260px] text-[15px] leading-relaxed text-slate">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Simulator */}
      <section className="bg-mist">
        <div className="mx-auto max-w-page px-4 py-20 sm:px-6">
          <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
            <h2 className="display text-[44px] sm:text-[64px]">See it survive a crash</h2>
            <p className="text-[18px] leading-relaxed text-charcoal">
              A live simulation using the Mezo BTC oracle. Pick a scenario and watch the agent
              defend the position while the unprotected loan gets liquidated.
            </p>
          </div>
          <Simulator mode="demo" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-page px-4 py-20 sm:px-6">
        <h2 className="display max-w-3xl text-[44px] sm:text-[64px]">Watch. Decide. Act.</h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {[
            {
              icon: <EyeIcon />,
              title: "Watch",
              body: "The agent reads your Mezo trove, the on-chain BTC price, and your safety funds every few seconds.",
            },
            {
              icon: <SlidersIcon />,
              title: "Decide",
              body: "Your rules define the trigger and the target. The agent computes the exact BTC top-up and MUSD repayment.",
            },
            {
              icon: <BoltIcon />,
              title: "Act",
              body: "Before ICR reaches 110%, it tops up collateral or repays debt on-chain. You get a Telegram alert with the tx.",
            },
          ].map((item) => (
            <div key={item.title}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mist text-forest">
                {item.icon}
              </span>
              <h3 className="mt-6 text-[22px] font-bold tracking-tight text-obsidian">{item.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-slate">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Defend, never drain */}
      <section className="px-4 sm:px-6">
        <div className="mx-auto grid max-w-page gap-10 rounded-large bg-forest p-8 sm:p-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:p-16">
          <div>
            <h2 className="display text-[44px] text-lime sm:text-[64px]">Defend. Never drain.</h2>
            <p className="mt-6 max-w-lg text-[18px] leading-relaxed text-paper/85">
              The vault gives the agent exactly two powers: add collateral and repay debt. It
              cannot withdraw BTC, move MUSD out, or change your rules. The owner keeps a kill
              switch on every action.
            </p>
          </div>
          <div className="rounded-panel bg-paper p-3">
            {[
              ["Add BTC collateral", true],
              ["Repay MUSD debt", true],
              ["Withdraw your BTC", false],
              ["Move MUSD out of the vault", false],
              ["Change your rules", false],
            ].map(([label, allowed]) => (
              <div
                key={label as string}
                className="flex items-center justify-between gap-3 rounded-card px-4 py-3.5 odd:bg-fog/60"
              >
                <span className="text-[15px] font-semibold text-obsidian">{label}</span>
                <span
                  className={cls(
                    "flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold",
                    allowed ? "bg-lime text-forest" : "bg-fog text-slate",
                  )}
                >
                  {allowed ? "✓ Agent can" : "✕ Never"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built on */}
      <section className="mx-auto max-w-page px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="heading text-[36px] sm:text-[45px]">Built on</h2>
          <p className="text-[15px] text-slate">
            Contracts on Mezo testnet · live oracle reads · {agentOnline ? "agent connected" : "agent offline"}
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Mezo", "Me"],
            ["MUSD", "$"],
            ["Bitcoin", "₿"],
            ["Solidity", "So"],
            ["TypeScript", "TS"],
            ["Telegram", "Tg"],
          ].map(([name, mark]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-fog text-[16px] font-black text-forest">
                {mark}
              </span>
              <span className="text-[16px] font-semibold text-forest">{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-mist">
        <div className="mx-auto flex max-w-page flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="display max-w-3xl text-[44px] sm:text-[72px]">Put a guardian on your loan</h2>
          <button className="btn btn-primary shrink-0 px-7 py-3.5 text-[16px]" onClick={primary}>
            {primaryLabel}
          </button>
        </div>
      </section>

      <footer className="bg-forest">
        <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo inverted />
          <p className="text-[14px] text-paper/70">
            Built for the Mezo Buildathon, Wave 1 · BTC collateral · MUSD · testnet only
          </p>
        </div>
      </footer>
    </main>
  );
}

function LoanCalculator({ onCreate, ctaLabel }: { onCreate: () => void; ctaLabel: string }) {
  const [collateral, setCollateral] = useState("0.5");
  const [debt, setDebt] = useState("22000");
  const [triggerLTV, setTriggerLTV] = useState(60);

  const coll = Number(collateral) || 0;
  const borrowed = Number(debt) || 0;
  const icr = coll > 0 && borrowed > 0 ? (coll * EXAMPLE_BTC_PRICE) / borrowed : 0;
  const ltv = icr > 0 ? 100 / icr : 0;
  const liquidationPrice = coll > 0 ? (borrowed * LIQUIDATION_ICR) / coll : 0;
  const triggerPrice = coll > 0 ? borrowed / ((triggerLTV / 100) * coll) : 0;
  const dropToTrigger = triggerPrice > 0 ? (1 - triggerPrice / EXAMPLE_BTC_PRICE) * 100 : 0;
  const unsafe = icr > 0 && icr < 1.3;

  return (
    <div className="rounded-large bg-paper p-5 shadow-xl sm:p-7">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-obsidian">Loan health check</p>
        <span className="text-[12px] font-medium text-slate">BTC at {fmtUsd(EXAMPLE_BTC_PRICE)} (example)</span>
      </div>

      <CalcField label="You deposit" value={collateral} onChange={setCollateral} unit="BTC" mark="₿" />
      <CalcField label="You borrow" value={debt} onChange={setDebt} unit="MUSD" mark="$" />

      <div className="mt-5 space-y-3 border-l-2 border-line pl-5 text-[14px]">
        <CalcRow label="Collateral ratio" value={icr ? fmtPct(icr * 100) : "—"} strong />
        <CalcRow label="Loan-to-value" value={icr ? fmtPct(ltv) : "—"} />
        <CalcRow label="Liquidation price" value={liquidationPrice ? fmtUsd(liquidationPrice) : "—"} />
        <CalcRow
          label={`Agent steps in at ${triggerLTV}% LTV`}
          value={
            triggerPrice
              ? dropToTrigger > 0
                ? `${fmtUsd(triggerPrice)} · −${fmtNum(dropToTrigger, 1)}%`
                : "Already past trigger"
              : "—"
          }
        />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[13px] font-semibold text-charcoal">
          <span>Trigger LTV</span>
          <span className="text-forest">{triggerLTV}%</span>
        </div>
        <input
          className="mt-3 w-full"
          type="range"
          min={40}
          max={80}
          value={triggerLTV}
          onChange={(event) => setTriggerLTV(Number(event.target.value))}
          aria-label="Trigger LTV"
        />
      </div>

      {unsafe ? (
        <p className="mt-4 rounded-card bg-[#fbe4e5] px-4 py-3 text-[13px] font-medium text-danger">
          ICR is below 130%. Mezo would reject this loan. Add BTC or borrow less.
        </p>
      ) : (
        <p className="mt-4 rounded-card bg-mist px-4 py-3 text-[13px] font-medium text-forest">
          The agent tops up from your BTC buffer or repays from your MUSD reserve before ICR hits 110%.
        </p>
      )}

      <button className="btn btn-primary mt-5 w-full py-3.5 text-[16px]" onClick={onCreate}>
        {ctaLabel}
      </button>
    </div>
  );
}

function CalcField({
  label,
  value,
  onChange,
  unit,
  mark,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  mark: string;
}) {
  return (
    <label className="mt-4 flex items-center justify-between gap-3 rounded-card border border-pebble px-4 py-2.5 transition focus-within:border-forest">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-slate">{label}</span>
        <input
          className="w-full bg-transparent text-[26px] font-bold tracking-tight text-obsidian outline-none"
          value={value}
          inputMode="decimal"
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      <span className="flex shrink-0 items-center gap-2 rounded-full bg-fog py-1.5 pl-1.5 pr-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[13px] font-black text-lime">
          {mark}
        </span>
        <span className="text-[15px] font-bold text-forest">{unit}</span>
      </span>
    </label>
  );
}

function CalcRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate">{label}</span>
      <span className={cls("text-right", strong ? "text-[16px] font-bold text-obsidian" : "font-semibold text-charcoal")}>
        {value}
      </span>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}
