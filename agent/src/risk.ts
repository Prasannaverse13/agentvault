import { simulate } from "./simulator.js";
import { icrOf, ltv, LIQUIDATION_ICR, ONE, type Rules } from "./rules.js";

export type RiskInput = {
  coll: bigint;
  debt: bigint;
  price: bigint;
  buffer: bigint;
  reserve: bigint;
  rules: Rules;
};

export type RiskReport = {
  active: boolean;
  /** 0 (very safe) to 100 (about to be liquidated). */
  score: number;
  band: "low" | "moderate" | "high" | "critical";
  /** Further BTC drop (%) before the agent steps in. */
  dropToTrigger: number;
  /** BTC drop (%) that liquidates an unprotected loan. */
  dropToLiquidation: number;
  /** BTC drop (%) the agent can defend with the current safety funds. */
  survivableDropWithAgent: number;
  /** Safety funds as a share of the debt, in percent. */
  coveragePct: number;
  safetyFundsUsd: number;
  ltv: number;
};

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

export function assessRisk(input: RiskInput): RiskReport {
  const { coll, debt, price, buffer, reserve, rules } = input;

  if (debt === 0n || coll === 0n || price === 0n) {
    return {
      active: false,
      score: 0,
      band: "low",
      dropToTrigger: 0,
      dropToLiquidation: 0,
      survivableDropWithAgent: 0,
      coveragePct: 0,
      safetyFundsUsd: 0,
      ltv: 0,
    };
  }

  const icr = icrOf(coll, debt, price);
  const triggerPrice = (rules.triggerICR * debt) / coll;
  const liqPrice = (LIQUIDATION_ICR * debt) / coll;
  const dropToTrigger =
    icr <= rules.triggerICR ? 0 : clampPct((1 - Number(triggerPrice) / Number(price)) * 100);
  const dropToLiquidation =
    icr <= LIQUIDATION_ICR ? 0 : clampPct((1 - Number(liqPrice) / Number(price)) * 100);

  // Bisection over a straight-line crash: the deepest drop where the agent still wins.
  let lo = 0;
  let hi = 95;
  for (let i = 0; i < 9; i += 1) {
    const mid = (lo + hi) / 2;
    const result = simulate({
      coll,
      debt,
      price,
      buffer,
      reserve,
      rules,
      scenario: "custom",
      crashPct: mid,
      steps: 40,
    });
    if (result.summary.agentLiquidated) hi = mid;
    else lo = mid;
  }

  const safetyFundsUsd = Number((buffer * price) / ONE) / 1e18 + Number(reserve) / 1e18;
  const debtNum = Number(debt) / 1e18;
  const coveragePct = debtNum > 0 ? (safetyFundsUsd / debtNum) * 100 : 0;

  // Distance to liquidation matters most; safety funds and agent reach soften it.
  const raw = 100 - dropToLiquidation * 1.1 - Math.min(coveragePct, 40) * 0.5 - lo * 0.2;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const band = score < 25 ? "low" : score < 50 ? "moderate" : score < 75 ? "high" : "critical";

  return {
    active: true,
    score,
    band,
    dropToTrigger,
    dropToLiquidation,
    survivableDropWithAgent: Math.round(lo * 10) / 10,
    coveragePct,
    safetyFundsUsd,
    ltv: ltv(icr),
  };
}
