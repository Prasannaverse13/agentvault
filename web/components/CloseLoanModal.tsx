"use client";

import { useEffect, useState } from "react";
import { erc20Abi, vaultAbi, CORE } from "@agentvault/shared";
import { parseEther, type Address, type Hash } from "viem";
import { publicClient } from "@/lib/chain";
import type { PositionView } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import type { ConnectedClient } from "@/lib/useWallet";
import { Modal, Spinner } from "./ui";

type RunTx = (label: string, fn: (client: ConnectedClient) => Promise<Hash>) => Promise<boolean>;

/**
 * Closing a loan repays the whole debt from the vault's MUSD reserve and hands
 * the collateral and BTC buffer back to the owner. If the reserve is short, the
 * modal tops it up from the owner's wallet first.
 */
export function CloseLoanModal({
  open,
  onClose,
  vault,
  owner,
  position,
  runTx,
}: {
  open: boolean;
  onClose: () => void;
  vault: Address;
  owner: Address | undefined;
  position: PositionView;
  runTx: RunTx;
}) {
  const [walletMusd, setWalletMusd] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !owner) return;
    let alive = true;
    publicClient
      .readContract({
        address: CORE.MUSD as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      })
      .then((value) => alive && setWalletMusd(Number(value) / 1e18))
      .catch(() => alive && setWalletMusd(null));
    return () => {
      alive = false;
    };
  }, [open, owner, position.fetchedAt]);

  const debt = position.debt;
  const reserve = position.musdReserve;
  const missing = Math.max(0, debt - reserve);
  const missingWei = parseEther(missing.toFixed(6));
  const canCover = walletMusd !== null && walletMusd + 1e-6 >= missing;
  const ready = missing <= 1e-6;

  const deposit = async () => {
    setBusy(true);
    try {
      await runTx(`Deposited ${fmtNum(missing, 2)} MUSD into the reserve`, async (client) => {
        const approve = await client.writeContract({
          address: CORE.MUSD as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, missingWei],
        });
        await publicClient.waitForTransactionReceipt({ hash: approve });
        return client.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "fundReserve",
          args: [missingWei],
        });
      });
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      const ok = await runTx("Loan closed. Your BTC was returned to your wallet.", (client) =>
        client.writeContract({ address: vault, abi: vaultAbi, functionName: "closeLoan" }),
      );
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Close this loan"
      subtitle="Repay the debt and take your BTC back."
      width="max-w-lg"
    >
      <div className="space-y-2.5 rounded-panel bg-fog/70 p-4 text-[14px]">
        <Line label="Debt to repay" value={`${fmtNum(debt, 2)} MUSD`} />
        <Line label="MUSD reserve in the vault" value={`${fmtNum(reserve, 2)} MUSD`} />
        <Line label="Your wallet MUSD" value={walletMusd === null ? "—" : `${fmtNum(walletMusd, 2)} MUSD`} />
        <div className="border-t border-line pt-2.5">
          <Line label="You get back" value={`${fmtNum(position.coll + position.btcBuffer, 4)} BTC`} strong />
        </div>
      </div>

      {!ready ? (
        <div className="mt-4 rounded-panel bg-[#fdf0d5] px-4 py-3 text-[14px] text-warn">
          <p className="font-semibold">
            The reserve is {fmtNum(missing, 2)} MUSD short of the debt.
          </p>
          <p className="mt-1">
            {canCover
              ? "Deposit the difference first. It stays yours and returns with the rest."
              : "Your wallet does not hold enough MUSD to cover the difference."}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-panel bg-mist px-4 py-3 text-[14px] font-medium text-forest">
          The reserve covers the debt. Closing will repay it and return everything else.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        {!ready ? (
          <button className="btn btn-dark py-3" onClick={deposit} disabled={busy || !canCover}>
            {busy ? <Spinner /> : null}
            Deposit {fmtNum(missing, 2)} MUSD
          </button>
        ) : (
          <button className="btn border-transparent bg-danger py-3 text-paper hover:!bg-[#a81f26]" onClick={close} disabled={busy}>
            {busy ? <Spinner /> : null}
            Close loan and return my BTC
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Keep the loan
        </button>
      </div>
    </Modal>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-bold text-obsidian" : "text-slate"}>{label}</span>
      <span className={strong ? "text-[16px] font-black text-forest" : "font-semibold text-obsidian"}>{value}</span>
    </div>
  );
}
