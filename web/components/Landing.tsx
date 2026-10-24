"use client";

import type { useWallet } from "@/lib/useWallet";
import { cls } from "@/lib/format";
import { Background3D } from "./Background3D";
import { Logo } from "./Header";
import { Badge } from "./ui";

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
  const primary = wallet.address ? onCreate : wallet.connect;
  const primaryLabel = wallet.address ? "Open a vault" : "Connect wallet";

  return (
    <main className="relative">
      <Background3D />
      <div className="relative z-10">
      {/* Hero */}
      <section className="mx-auto max-w-page px-4 pb-4 pt-10 text-center sm:px-6 lg:pt-16">
        <div className="animate-fade-up">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge tone="accent">Mezo Buildathon · DeFi</Badge>
            <Badge tone={agentOnline ? "good" : "warn"}>
              <span className={cls("h-2 w-2 rounded-full", agentOnline ? "bg-good" : "bg-warn")} />
              Agent {agentOnline ? "online" : "offline"}
            </Badge>
          </div>

          <h1 className="display mx-auto mt-7 max-w-5xl text-[52px] sm:text-[84px] lg:text-[104px]">
            Your BTC loan should never surprise you
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-[18px] leading-[1.55] text-charcoal">
            AgentVault is an autonomous risk agent for Bitcoin-backed MUSD loans on Mezo. It
            watches your collateral ratio around the clock, tops up BTC or repays debt before
            liquidation, and shows you every decision before it acts.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            <button className="btn btn-primary px-7 py-3.5 text-[16px]" onClick={primary}>
              {primaryLabel}
            </button>
            <a className="link text-[16px]" href="#how">
              How it works
            </a>
          </div>

          {wallet.error ? <p className="mt-4 text-[14px] text-danger">{wallet.error}</p> : null}
        </div>

        <div className="animate-fade-up mt-14" style={{ animationDelay: "120ms" }}>
          <HeroArt />
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

      {/* How it works */}
      <section id="how" className="mx-auto max-w-page scroll-mt-20 px-4 py-20 sm:px-6">
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
      </div>
    </main>
  );
}

function HeroArt() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto flex h-[260px] max-w-4xl items-center justify-center overflow-hidden rounded-large bg-forest sm:h-[360px]"
    >
      {[
        ["₿", "left-[8%] top-[18%] h-16 w-16 text-[28px] sm:h-24 sm:w-24 sm:text-[40px]"],
        ["$", "right-[10%] top-[14%] h-14 w-14 text-[24px] sm:h-20 sm:w-20 sm:text-[34px]"],
        ["₿", "right-[18%] bottom-[10%] h-12 w-12 text-[20px] sm:h-16 sm:w-16 sm:text-[26px]"],
        ["$", "left-[20%] bottom-[12%] h-12 w-12 text-[20px] sm:h-[72px] sm:w-[72px] sm:text-[30px]"],
      ].map(([mark, pos], index) => (
        <span
          key={index}
          className={cls(
            "absolute flex items-center justify-center rounded-full bg-lime font-black text-forest",
            pos,
          )}
        >
          {mark}
        </span>
      ))}
      <svg viewBox="0 0 120 140" className="h-[200px] w-auto sm:h-[290px]" fill="none">
        <path
          d="M60 6 108 26v36c0 29-20 52-48 62-28-10-48-33-48-62V26L60 6Z"
          fill="#9fe870"
        />
        <path d="M66 32 38 74h20l-6 34 30-44H62l4-32Z" fill="#163300" />
      </svg>
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
