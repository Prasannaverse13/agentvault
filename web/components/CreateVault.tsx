"use client";

import { useEffect, useState } from "react";
import {
  borrowerOpsAbi,
  erc20Abi,
  factoryAbi,
  priceFeedAbi,
  vaultAbi,
  CORE,
} from "@agentvault/shared";
import { parseEther, type Address, type Hash } from "viem";
import { IS_DEMO, publicClient } from "@/lib/chain";
import type { AgentConfig, AgentHealth } from "@/lib/api";
import { api } from "@/lib/api";
import { fmtNum, fmtPct, shortAddr } from "@/lib/format";
import { walletErrorMessage, type useWallet } from "@/lib/useWallet";
import { Badge, Modal, Spinner, Stat } from "./ui";

type Wallet = ReturnType<typeof useWallet>;

export function CreateVault({
  open,
  onClose,
  wallet,
  config,
  agent,
  existingVault,
  onCreated,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  wallet: Wallet;
  config: AgentConfig | null;
  agent: AgentHealth | null;
  /** Open a new loan on a vault that already exists (skips vault creation). */
  existingVault?: Address;
  onCreated: (vault: Address) => void;
  notify: (message: string, kind?: "ok" | "err") => void;
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [vault, setVault] = useState<Address | null>(null);
  const [triggerLTV, setTriggerLTV] = useState(60);
  const [targetLTV, setTargetLTV] = useState(50);
  const defaults = IS_DEMO
    ? { collateral: "1", debt: "40000", buffer: "0.25", reserve: "5000" }
    : { collateral: "0.05", debt: "2000", buffer: "0.005", reserve: "200" };
  const [collateral, setCollateral] = useState(defaults.collateral);
  const [debt, setDebt] = useState(defaults.debt);
  const [buffer, setBuffer] = useState(defaults.buffer);
  const [reserve, setReserve] = useState(defaults.reserve);
  const [price, setPrice] = useState<number | null>(null);
  const [minDebt, setMinDebt] = useState(1800);

  useEffect(() => {
    if (!open) return;
    setStep(existingVault ? 2 : 1);
    setVault(existingVault ?? null);
    Promise.all([
      publicClient.readContract({
        address: CORE.PRICE_FEED as Address,
        abi: priceFeedAbi,
        functionName: "fetchPrice",
      }),
      publicClient.readContract({
        address: CORE.BORROWER_OPERATIONS as Address,
        abi: borrowerOpsAbi,
        functionName: "minNetDebt",
      }),
    ])
      .then(([feedPrice, minimum]) => {
        setPrice(Number(feedPrice) / 1e18);
        setMinDebt(Number(minimum) / 1e18);
        setDebt(String(Math.max(Number(defaults.debt), Number(minimum) / 1e18)));
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingVault]);

  const factory = config?.factory as Address | undefined;
  const agentAddress = (config?.agent ?? agent?.agent) as Address | null | undefined;
  const coll = Number(collateral);
  const debtValue = Number(debt);
  const icr = price && coll > 0 && debtValue > 0 ? (coll * price) / debtValue : 0;
  const ltv = icr > 0 ? 100 / icr : 0;

  const createVault = async () => {
    if (!wallet.address) {
      await wallet.connect();
      return;
    }
    if (!factory) {
      notify("Factory is not configured on the agent. Set FACTORY_ADDRESS.", "err");
      return;
    }
    if (!agentAddress) {
      notify("Agent address is not available. Is the agent running?", "err");
      return;
    }
    setBusy(true);
    try {
      const client = await wallet.requireClient();
      if (!client) return;
      notify("Creating your vault…");
      const triggerICR = parseEther((100 / triggerLTV).toFixed(4));
      const targetICR = parseEther((100 / targetLTV).toFixed(4));
      const hash = await client.writeContract({
        address: factory,
        abi: factoryAbi,
        functionName: "createVault",
        args: [agentAddress, triggerICR, targetICR],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      const vaults = await publicClient.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "getVaults",
        args: [wallet.address],
      });
      const created = vaults[vaults.length - 1];
      if (!created) throw new Error("Vault creation did not return an address");
      setVault(created);
      onCreated(created);
      await api.watch(created).catch(() => undefined);
      notify("Vault created. Now open your loan.");
      setStep(2);
    } catch (error) {
      notify(walletErrorMessage(error), "err");
    } finally {
      setBusy(false);
    }
  };

  const openLoan = async () => {
    if (!vault) return;
    if (!coll || coll <= 0) {
      notify("Enter a BTC amount", "err");
      return;
    }
    if (debtValue < minDebt) {
      notify(`Minimum debt is ${fmtNum(minDebt, 0)} MUSD`, "err");
      return;
    }
    if (icr < 1.3) {
      notify("ICR is below 130%. Add collateral or borrow less.", "err");
      return;
    }
    setBusy(true);
    try {
      const client = await wallet.requireClient();
      if (!client) return;
      notify("Opening the MUSD loan…");
      const hash = await client.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "openLoan",
        args: [parseEther(debt)],
        value: parseEther(collateral),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      notify("Loan opened. MUSD is in your wallet.");
      setStep(3);
    } catch (error) {
      notify(walletErrorMessage(error), "err");
    } finally {
      setBusy(false);
    }
  };

  const tx = async (label: string, fn: (client: NonNullable<ReturnType<Wallet["getClient"]>>) => Promise<Hash>) => {
    setBusy(true);
    try {
      const client = await wallet.requireClient();
      if (!client) return;
      notify("Confirm in your wallet…");
      const hash = await fn(client);
      await publicClient.waitForTransactionReceipt({ hash });
      notify(label);
    } catch (error) {
      notify(walletErrorMessage(error), "err");
    } finally {
      setBusy(false);
    }
  };

  const addBuffer = () => {
    if (!vault) return;
    void tx(`Added ${buffer} BTC buffer`, (client) =>
      client.sendTransaction({ to: vault, value: parseEther(buffer) }),
    );
  };

  const addReserve = () => {
    if (!vault) return;
    const parsed = parseEther(reserve);
    void tx(`Funded ${reserve} MUSD reserve`, async (client) => {
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
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open an AgentVault"
      subtitle="One vault, one trove, one autonomous guardian."
      width="max-w-2xl"
    >
      <div className="mb-5 flex items-center gap-2 text-[14px] text-slate">
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${
                step >= item ? "bg-forest text-lime" : "bg-fog text-slate"
              }`}
            >
              {item}
            </span>
            <span className={step === item ? "text-forest" : ""}>
              {item === 1 ? "Vault" : item === 2 ? "Loan" : "Safety"}
            </span>
            {item < 3 ? <span className="h-0.5 w-8 rounded-full bg-line" /> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="rounded-panel bg-fog/60 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate">Guardian agent</span>
              <span className="font-mono text-[13px] text-obsidian">
                {agentAddress ? shortAddr(agentAddress) : "agent offline"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-slate">Factory</span>
              <span className="font-mono text-[13px] text-obsidian">
                {factory ? shortAddr(factory) : "not configured"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-slate">BTC oracle</span>
              <span className="text-[13px] text-obsidian">{price ? `$${fmtNum(price, 0)}` : "loading…"}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate">Agent triggers at</span>
              <span className="text-obsidian">{triggerLTV}% LTV · {(10000 / triggerLTV).toFixed(0)}% ICR</span>
            </div>
            <input
              className="mt-2 w-full"
              type="range"
              min={40}
              max={75}
              value={triggerLTV}
              onChange={(event) => {
                const next = Number(event.target.value);
                setTriggerLTV(next);
                if (targetLTV > next - 5) setTargetLTV(Math.max(30, next - 5));
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate">Restores to</span>
              <span className="text-obsidian">{targetLTV}% LTV · {(10000 / targetLTV).toFixed(0)}% ICR</span>
            </div>
            <input
              className="mt-2 w-full"
              type="range"
              min={30}
              max={70}
              value={targetLTV}
              onChange={(event) => setTargetLTV(Math.min(Number(event.target.value), triggerLTV - 5))}
            />
          </div>

          <button className="btn btn-primary w-full" onClick={createVault} disabled={busy}>
            {busy ? <Spinner /> : null}
            {wallet.address ? "Create vault" : "Connect wallet to create"}
          </button>
          <p className="text-center text-[14px] text-slate">
            The agent can only add collateral and repay debt. It can never withdraw.
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">BTC collateral</label>
              <input
                className="input"
                value={collateral}
                onChange={(event) => setCollateral(event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="label">MUSD to borrow</label>
              <input
                className="input"
                value={debt}
                onChange={(event) => setDebt(event.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="BTC price" value={price ? `$${fmtNum(price, 0)}` : "—"} />
            <Stat label="ICR" value={icr ? fmtPct(icr * 100) : "—"} />
            <Stat label="LTV" value={icr ? fmtPct(ltv) : "—"} />
          </div>

          <div className="rounded-panel bg-fog/60 px-4 py-3 text-[13px] leading-relaxed text-slate">
            Minimum debt is {fmtNum(minDebt, 0)} MUSD. Keep ICR above 150% so a normal dip does not
            threaten the loan. The MUSD is minted to your wallet when the trove opens.
          </div>

          <button className="btn btn-primary w-full" onClick={openLoan} disabled={busy}>
            {busy ? <Spinner /> : null}
            Open loan
          </button>
          <button className="btn btn-ghost w-full text-[13px]" onClick={() => setStep(3)} disabled={busy}>
            Skip for now
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge tone="good">Vault live</Badge>
            <span className="font-mono text-[13px] text-slate">{vault}</span>
          </div>

          <div className="rounded-panel bg-fog/60 p-4">
            <p className="text-[17px] font-bold text-obsidian">Give the agent ammo</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate">
              The agent can only spend what sits in the vault. A BTC buffer is used for collateral
              top-ups; a MUSD reserve is used to repay debt. Both stay under your ownership.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                className="input"
                value={buffer}
                onChange={(event) => setBuffer(event.target.value)}
                inputMode="decimal"
              />
              <button className="btn shrink-0 text-[13px]" onClick={addBuffer} disabled={busy}>
                Add BTC buffer
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="input"
                value={reserve}
                onChange={(event) => setReserve(event.target.value)}
                inputMode="decimal"
              />
              <button className="btn shrink-0 text-[13px]" onClick={addReserve} disabled={busy}>
                Fund MUSD reserve
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={() => {
              if (vault) onCreated(vault);
              onClose();
            }}
          >
            Finish setup
          </button>
          <p className="text-center text-[14px] text-slate">
            You can add safety funds any time from the dashboard.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

