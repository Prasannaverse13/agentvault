import type { Address } from "viem";
import { config } from "./config.js";
import { readVault, protectVault, agentAccount, type VaultSnapshot } from "./chain.js";
import { decide, type Decision } from "./rules.js";
import { store } from "./store.js";
import { notify } from "./telegram.js";
import { watchlist } from "./watchlist.js";

const lastAction = new Map<string, number>();
const lastAlert = new Map<string, number>();

export type CheckResult = {
  vault: VaultSnapshot;
  decision: Decision;
  executed: boolean;
  txHash?: string;
  error?: string;
};

export async function runCheck(vaultAddress: Address, force = false): Promise<CheckResult> {
  const vault = await readVault(vaultAddress);
  const decision = decide(
    {
      coll: vault.coll,
      debt: vault.debt,
      price: vault.price,
      buffer: vault.btcBuffer,
      reserve: vault.musdReserve,
    },
    {
      triggerICR: vault.triggerICR,
      targetICR: vault.targetICR,
      autoProtect: vault.autoProtect,
    },
  );

  const key = vaultAddress.toLowerCase();
  const now = Date.now();
  const isAgent =
    !!agentAccount && vault.agent.toLowerCase() === agentAccount.address.toLowerCase();

  if (
    decision.kind !== "hold" &&
    config.execute &&
    isAgent &&
    (force || now - (lastAction.get(key) ?? 0) > 60_000)
  ) {
    try {
      const txHash = await protectVault(
        vaultAddress,
        decision.repayAmount,
        decision.topUpAmount,
      );
      lastAction.set(key, now);
      store.add({
        vault: vaultAddress,
        type: "execution",
        kind: decision.kind,
        title: "Agent protected the loan",
        detail: `${decision.reason}. Topped up ${(Number(decision.topUpAmount) / 1e18).toFixed(4)} BTC, repaid ${(Number(decision.repayAmount) / 1e18).toFixed(2)} MUSD.`,
        txHash,
        data: {
          topUpAmount: decision.topUpAmount.toString(),
          repayAmount: decision.repayAmount.toString(),
          price: vault.price.toString(),
          icrBefore: decision.icr.toString(),
          icrAfter: decision.projectedICR.toString(),
        },
      });
      await notify(
        `*AgentVault protected a loan*\n${decision.reason}\nTop up: ${(Number(decision.topUpAmount) / 1e18).toFixed(4)} BTC\nRepay: ${(Number(decision.repayAmount) / 1e18).toFixed(2)} MUSD\nTx: ${txHash}`,
      );
      return { vault, decision, executed: true, txHash };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const message = raw.split("\n")[0].slice(0, 200);
      lastAction.set(key, now);
      store.add({
        vault: vaultAddress,
        type: "alert",
        title: "Agent action failed",
        detail: message,
      });
      await notify(`*AgentVault action failed*\n${message}`);
      return { vault, decision, executed: false, error: message };
    }
  }

  if (decision.kind === "hold" && decision.reason.startsWith("Danger")) {
    if (now - (lastAlert.get(key) ?? 0) > 300_000) {
      lastAlert.set(key, now);
      store.add({
        vault: vaultAddress,
        type: "alert",
        title: "Loan at risk - safety funds empty",
        detail: decision.reason,
      });
      await notify(`*AgentVault warning*\n${decision.reason}\nDeposit BTC buffer or MUSD reserve to let the agent act.`);
    }
  }

  return { vault, decision, executed: false };
}

export async function registerVault(vault: Address): Promise<{ ok: boolean; error?: string }> {
  const snapshot = await readVault(vault);
  if (!agentAccount || snapshot.agent.toLowerCase() !== agentAccount.address.toLowerCase()) {
    return { ok: false, error: "Agent is not authorised on this vault" };
  }
  watchlist.add(vault);
  return { ok: true };
}
