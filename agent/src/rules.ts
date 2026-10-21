export type Position = {
  coll: bigint;
  debt: bigint;
  price: bigint;
  buffer: bigint;
  reserve: bigint;
};

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

export const ONE = 10n ** 18n;
export const LIQUIDATION_ICR = 1_100_000_000_000_000_000n;

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
  const { coll, debt, price, buffer, reserve } = position;
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
  const repayAmount = deficitDebt < reserve ? deficitDebt : reserve;

  let kind: DecisionKind = "hold";
  if (topUpAmount > 0n && repayAmount > 0n) kind = "both";
  else if (topUpAmount > 0n) kind = "topUp";
  else if (repayAmount > 0n) kind = "repay";

  const projectedICR = icrOf(
    coll + topUpAmount,
    debt - repayAmount,
    price,
  );

  if (kind === "hold") {
    return {
      kind,
      topUpAmount: 0n,
      repayAmount: 0n,
      icr,
      projectedICR: icr,
      reason: `Danger: ICR ${formatPct(icr)} is below trigger but the BTC buffer and MUSD reserve are empty`,
    };
  }

  return {
    kind,
    topUpAmount,
    repayAmount,
    icr,
    projectedICR,
    reason: `ICR ${formatPct(icr)} fell below ${formatPct(rules.triggerICR)}; restore toward ${formatPct(rules.targetICR)}`,
  };
}

export function formatPct(value: bigint): string {
  return `${(Number(value) / 1e16).toFixed(1)}%`;
}
