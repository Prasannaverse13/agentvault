import type { Address } from "viem";
import { config } from "./config.js";
import { readVault, protectVault, vaultWrite, agentAccount, type VaultSnapshot } from "./chain.js";
import { decide, type Decision } from "./rules.js";
import { store } from "./store.js";
import { notify } from "./telegram.js";
import { watchlist } from "./watchlist.js";

const lastAction = new Map<string, number>();
const lastHousekeeping = new Map<string, number>();
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
      pooled: vault.pooledMusd,
      maxRepay: vault.repayCap,
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

  if (decision.kind === "hold" && config.execute && isAgent && vault.v2) {
    await housekeeping(vaultAddress, vault, force).catch(() => undefined);
  }

  return { vault, decision, executed: false };
}

const ONE_MUSD = 10n ** 18n;
const STATUS_ACTIVE = 1;

/**
 * v2 jobs that run when the loan is not in danger:
 *  1. claim surplus BTC after a redemption and send it to the owner,
 *  2. harvest Stability Pool BTC gains into the trove as collateral,
 *  3. put idle MUSD reserve to work in the Stability Pool (keeping a liquid share).
 * Each job is simulated before sending, and rate limited per vault.
 */
async function housekeeping(vaultAddress: Address, vault: VaultSnapshot, force: boolean) {
  const key = vaultAddress.toLowerCase();
  const now = Date.now();
  if (!force && now - (lastHousekeeping.get(key) ?? 0) < 10 * 60_000) return;
  lastHousekeeping.set(key, now);

  // 1. Redeemed or liquidated in Recovery Mode: surplus BTC waits in Mezo's CollSurplusPool.
  if (vault.status === 3 || vault.status === 4) {
    try {
      const txHash = await vaultWrite(vaultAddress, "claimSurplus", (b, n) => n.surplusClaimed > b.surplusClaimed);
      const after = await readVault(vaultAddress);
      const amount = after.surplusClaimed - vault.surplusClaimed;
      store.add({
        vault: vaultAddress,
        type: "execution",
        kind: "surplus",
        title: "Recovered surplus BTC for the owner",
        detail: `The loan was ${vault.status === 4 ? "redeemed" : "liquidated"}. The agent claimed ${(Number(amount) / 1e18).toFixed(6)} BTC from Mezo's surplus pool and sent it to the owner.`,
        txHash,
      });
      await notify(`*AgentVault recovered surplus BTC*\n${(Number(amount) / 1e18).toFixed(6)} BTC sent to the owner.\nTx: ${txHash}`);
    } catch {
      // Nothing to claim. The simulation reverts and no gas is spent.
    }
    return;
  }

  if (vault.status !== STATUS_ACTIVE) return;

  // 2. Harvest liquidation gains from the Stability Pool into the trove.
  if (Number(vault.pendingBtcGain) / 1e18 >= config.harvestMinBtc) {
    try {
      const txHash = await vaultWrite(vaultAddress, "harvest", (b, n) => n.earnedBtc > b.earnedBtc);
      const fee = (vault.pendingBtcGain * vault.performanceFeeBps) / 10_000n;
      store.add({
        vault: vaultAddress,
        type: "execution",
        kind: "harvest",
        title: "Harvested Stability Pool BTC into the loan",
        detail: `The MUSD reserve earned ${(Number(vault.pendingBtcGain) / 1e18).toFixed(6)} BTC from Mezo liquidations. ${(Number(vault.pendingBtcGain - fee) / 1e18).toFixed(6)} BTC was added to the loan as collateral.`,
        txHash,
      });
      await notify(`*AgentVault harvested yield*\n+${(Number(vault.pendingBtcGain - fee) / 1e18).toFixed(6)} BTC collateral from the Stability Pool.\nTx: ${txHash}`);
      return;
    } catch {
      // Gain too small or already harvested.
    }
  }

  // 3. Auto-earn: keep a liquid share for instant repays, pool the rest.
  if (config.autoEarn && vault.icr >= vault.triggerICR) {
    const total = vault.musdReserve + vault.pooledMusd;
    const keep = (total * BigInt(Math.round(config.earnKeepLiquidPct))) / 100n;
    const excess = vault.musdReserve > keep ? vault.musdReserve - keep : 0n;
    if (excess >= ONE_MUSD) {
      try {
        const txHash = await vaultWrite(
          vaultAddress,
          "earnDeposit",
          (b, n) => n.pooledMusd > b.pooledMusd,
          excess,
        );
        store.add({
          vault: vaultAddress,
          type: "execution",
          kind: "earn",
          title: "Put idle MUSD to work",
          detail: `Moved ${(Number(excess) / 1e18).toFixed(2)} MUSD of the reserve into the Mezo Stability Pool. ${config.earnKeepLiquidPct}% stays liquid for instant repays; the agent unwinds the pool when the loan needs it.`,
          txHash,
        });
      } catch {
        // Earn disabled on this vault or the pool refused the deposit.
      }
    }
  }
}

export async function registerVault(vault: Address): Promise<{ ok: boolean; error?: string }> {
  const snapshot = await readVault(vault);
  if (!agentAccount || snapshot.agent.toLowerCase() !== agentAccount.address.toLowerCase()) {
    return { ok: false, error: "Agent is not authorised on this vault" };
  }
  watchlist.add(vault);
  return { ok: true };
}
