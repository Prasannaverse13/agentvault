import { decide, ltv as ltvFromICR, vaultAbi } from "@agentvault/shared";
import type { Address } from "viem";
import { publicClient } from "./chain";
import type { DecisionView, PositionView, StatusResponse } from "./api";

/**
 * Reads a vault straight from the Mezo chain and mirrors the agent's decision
 * with the shared rules engine. Used as a fallback when the agent service is
 * unreachable, so the dashboard still shows the truth.
 */
export async function readVaultOnChain(vault: Address): Promise<StatusResponse> {
  const [health, owner, agent, autoProtect, triggerICR, targetICR, liquidationPrice] =
    await Promise.all([
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "health" }),
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "owner" }),
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "agent" }),
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "autoProtect" }),
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "triggerICR" }),
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "targetICR" }),
      publicClient
        .readContract({ address: vault, abi: vaultAbi, functionName: "liquidationPrice" })
        .catch(() => 0n),
    ]);

  const [coll, debt, price, icr, status, btcBuffer, musdReserve] = health as readonly bigint[];
  const icrPct = Number(icr) / 1e16;

  const position: PositionView = {
    address: vault,
    owner,
    agent,
    autoProtect,
    status: Number(status),
    coll: Number(coll) / 1e18,
    debt: Number(debt) / 1e18,
    price: Number(price) / 1e18,
    icr: icrPct,
    ltv: ltvFromICR(icr),
    liquidationPrice: Number(liquidationPrice) / 1e18,
    btcBuffer: Number(btcBuffer) / 1e18,
    musdReserve: Number(musdReserve) / 1e18,
    triggerICR: Number(triggerICR) / 1e16,
    targetICR: Number(targetICR) / 1e16,
    triggerLTV: ltvFromICR(triggerICR),
    targetLTV: ltvFromICR(targetICR),
    health: icrPct >= 200 ? "safe" : icrPct >= 150 ? "watch" : "danger",
    agentConnected: true,
    fetchedAt: Date.now(),
  };

  const decision = decide(
    {
      coll,
      debt,
      price,
      buffer: btcBuffer,
      reserve: musdReserve,
    },
    { triggerICR, targetICR, autoProtect },
  );

  const decisionView: DecisionView = {
    kind: decision.kind,
    topUpAmount: Number(decision.topUpAmount) / 1e18,
    repayAmount: Number(decision.repayAmount) / 1e18,
    icr: Number(decision.icr) / 1e16,
    projectedICR: Number(decision.projectedICR) / 1e16,
    reason: decision.reason,
  };

  return { position, decision: decisionView, events: [] };
}
