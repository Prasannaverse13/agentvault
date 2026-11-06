/**
 * The AgentVault rules engine.
 *
 * This is the single source of truth for "what should the agent do right now".
 * It is shared by the agent service (which executes the action) and by the web
 * dashboard (which mirrors the decision when the agent service is unreachable),
 * so the UI can never disagree with the on-chain behaviour.
 */

export const ONE = 10n ** 18n;
export const LIQUIDATION_ICR = 1_100_000_000_000_000_000n;

export type Position = {
  coll: bigint;
  debt: bigint;
  price: bigint;
  buffer: bigint;
  /** Liquid MUSD sitting in the vault. */
  reserve: bigint;
  /** v2: MUSD the vault keeps in the Mezo Stability Pool. protect() unwinds it. */
  pooled?: bigint;
  /** v2: largest repay that keeps the trove at Mezo's minimum net debt. */
  maxRepay?: bigint;
};

/** Mezo keeps 200 MUSD of gas compensation inside every trove's debt. */
export const MUSD_GAS_COMPENSATION = 200n * 10n ** 18n;
/** Mezo's minimum net debt (BorrowerOperations.minNetDebt) on testnet and mainnet. */
export const MIN_NET_DEBT = 1800n * 10n ** 18n;

/** Largest repay Mezo accepts before the trove would fall under its minimum debt. */
export function repayCap(debt: bigint, minNetDebt: bigint = MIN_NET_DEBT): bigint {
  const floor = minNetDebt + MUSD_GAS_COMPENSATION;
  return debt > floor ? debt - floor : 0n;
}

export type Rules = {
  triggerICR: bigint;
  targetICR: bigint;
  autoProtect: boolean;
};

export type DecisionKind = "hold" | "topUp" | "repay" | "both";

export type Decision = {
  kind: DecisionKind;
  topUpAmount: bigint;
  repayAmount: bigint;
  icr: bigint;
  projectedICR: bigint;
  reason: string;
};

export function icrOf(coll: bigint, debt: bigint, price: bigint): bigint {
  if (debt === 0n) return 0n;
  return (coll * price) / debt;
}

export function liquidationPrice(coll: bigint, debt: bigint): bigint {
  if (coll === 0n) return 0n;
  return (debt * LIQUIDATION_ICR) / coll;
}

export function ltv(icr: bigint): number {
  if (icr === 0n) return 0;
  return Number((ONE * 10_000n) / icr) / 100;
}

export function decide(position: Position, rules: Rules): Decision {
  const { coll, debt, price, buffer } = position;
  const reserve = position.reserve + (position.pooled ?? 0n);
  const cap = position.maxRepay ?? repayCap(debt);
  const icr = icrOf(coll, debt, price);

  if (debt === 0n || coll === 0n) {
    return {
      kind: "hold",
      topUpAmount: 0n,
      repayAmount: 0n,
      icr,
      projectedICR: icr,
      reason: "No active loan",
    };
  }

  if (!rules.autoProtect) {
    return {
      kind: "hold",
      topUpAmount: 0n,
      repayAmount: 0n,
      icr,
      projectedICR: icr,
      reason: "Agent is paused by the owner",
    };
  }

  if (icr >= rules.triggerICR) {
    return {
      kind: "hold",
      topUpAmount: 0n,
      repayAmount: 0n,
      icr,
      projectedICR: icr,
      reason: `Healthy: ICR ${formatPct(icr)} is above the ${formatPct(rules.triggerICR)} trigger`,
    };
  }

  const targetColl = (debt * rules.targetICR) / price;
  const deficitColl = targetColl > coll ? targetColl - coll : 0n;
  const topUpAmount = deficitColl < buffer ? deficitColl : buffer;

  const collAfterTopUp = coll + topUpAmount;
  const targetDebt = (collAfterTopUp * price) / rules.targetICR;
  const deficitDebt = debt > targetDebt ? debt - targetDebt : 0n;
  let repayAmount = deficitDebt < reserve ? deficitDebt : reserve;
  // Never ask for more than Mezo allows: it would revert at the min-debt check.
  if (repayAmount > cap) repayAmount = cap;

  let kind: DecisionKind = "hold";
  if (topUpAmount > 0n && repayAmount > 0n) kind = "both";
  else if (topUpAmount > 0n) kind = "topUp";
  else if (repayAmount > 0n) kind = "repay";

  const projectedICR = icrOf(coll + topUpAmount, debt - repayAmount, price);

  if (kind === "hold") {
    return {
      kind,
      topUpAmount: 0n,
      repayAmount: 0n,
      icr,
      projectedICR: icr,
      reason:
        reserve > 0n && cap === 0n && buffer === 0n
          ? `Danger: ICR ${formatPct(icr)} is below trigger, the loan is at Mezo's minimum debt and the BTC buffer is empty`
          : `Danger: ICR ${formatPct(icr)} is below trigger but the BTC buffer and MUSD reserve are empty`,
    };
  }

  return {
    kind,
    topUpAmount,
    repayAmount,
    icr,
    projectedICR,
    reason: `ICR ${formatPct(icr)} fell below ${formatPct(rules.triggerICR)}; restore toward ${formatPct(rules.targetICR)}${
      repayAmount > position.reserve ? " (unwinding Stability Pool MUSD)" : ""
    }`,
  };
}

export function formatPct(value: bigint): string {
  return `${(Number(value) / 1e16).toFixed(1)}%`;
}
