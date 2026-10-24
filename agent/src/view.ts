import { agentAccount, type VaultSnapshot } from "./chain.js";
import { ltv, type Decision } from "./rules.js";

export function snapshotView(s: VaultSnapshot) {
  const icr = Number(s.icr) / 1e16;
  return {
    address: s.address,
    owner: s.owner,
    agent: s.agent,
    autoProtect: s.autoProtect,
    status: s.status,
    coll: Number(s.coll) / 1e18,
    debt: Number(s.debt) / 1e18,
    price: Number(s.price) / 1e18,
    icr,
    ltv: ltv(s.icr),
    liquidationPrice: Number(s.liquidationPrice) / 1e18,
    btcBuffer: Number(s.btcBuffer) / 1e18,
    musdReserve: Number(s.musdReserve) / 1e18,
    triggerICR: Number(s.triggerICR) / 1e16,
    targetICR: Number(s.targetICR) / 1e16,
    triggerLTV: ltv(s.triggerICR),
    targetLTV: ltv(s.targetICR),
    // A vault with no active loan has nothing at risk.
    health: s.status !== 1 ? "safe" : icr >= 200 ? "safe" : icr >= 150 ? "watch" : "danger",
    agentConnected:
      !!agentAccount && s.agent.toLowerCase() === agentAccount.address.toLowerCase(),
    fetchedAt: s.fetchedAt,
  };
}

export function decisionView(d: Decision) {
  return {
    kind: d.kind,
    topUpAmount: Number(d.topUpAmount) / 1e18,
    repayAmount: Number(d.repayAmount) / 1e18,
    icr: Number(d.icr) / 1e16,
    projectedICR: Number(d.projectedICR) / 1e16,
    reason: d.reason,
  };
}

export type SnapshotView = ReturnType<typeof snapshotView>;
export type DecisionView = ReturnType<typeof decisionView>;
