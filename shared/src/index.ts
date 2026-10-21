export * from "./addresses";
export * from "./abi";

export const ICR_PRECISION = 10n ** 18n;
export const BPS = 10_000n;

export type VaultHealth = {
  coll: bigint;
  debt: bigint;
  price: bigint;
  icr: bigint;
  status: number;
  btcBuffer: bigint;
  musdReserve: bigint;
};

export type Rules = {
  triggerICR: bigint;
  targetICR: bigint;
  autoProtect: boolean;
};

export type AgentActionKind = "topUp" | "repay" | "hold" | "yield";

export type AgentDecision = {
  kind: AgentActionKind;
  topUpAmount: bigint;
  repayAmount: bigint;
  reason: string;
};

export const ONE = 1_000_000_000_000_000_000n;

export function formatUnits(value: bigint, decimals = 18, digits = 2): string {
  const negative = value < 0n;
  const v = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, digits).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toLocaleString("en-US")}${fracStr ? `.${fracStr}` : ""}`;
}

export function ltvFromICR(icr: bigint): number {
  if (icr === 0n) return 0;
  return Number((ICR_PRECISION * 10_000n) / icr) / 100;
}

export function liquidationPrice(debt: bigint, coll: bigint, minICR = 1_100_000_000_000_000_000n): bigint {
  if (coll === 0n) return 0n;
  return (debt * minICR) / coll;
}

export function riskBand(icr: bigint): "safe" | "watch" | "danger" {
  if (icr >= 2_000_000_000_000_000_000n) return "safe";
  if (icr >= 1_500_000_000_000_000_000n) return "watch";
  return "danger";
}

