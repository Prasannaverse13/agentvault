import { decide, icrOf, LIQUIDATION_ICR, type Rules } from "./rules.js";

export type Scenario = "crash" | "dip" | "blackswan" | "custom";

export type SimInput = {
  coll: bigint;
  debt: bigint;
  buffer: bigint;
  reserve: bigint;
  price: bigint;
  rules: Rules;
  scenario: Scenario;
  crashPct?: number;
  steps?: number;
  targetICR?: bigint;
};

export type SimStep = {
  t: number;
  price: number;
  icr: number;
  action: "hold" | "topUp" | "repay" | "both" | "liquidated";
  topUp: number;
  repay: number;
  coll: number;
  debt: number;
  buffer: number;
  reserve: number;
  liquidationPrice: number;
  saved: boolean;
};

export type SimResult = {
  scenario: Scenario;
  startPrice: number;
  endPrice: number;
  crashPct: number;
  agentSteps: SimStep[];
  baselineSteps: SimStep[];
  summary: {
    agentLiquidated: boolean;
    baselineLiquidated: boolean;
    minICRAgent: number;
    minICRBaseline: number;
    finalICR: number;
    actions: number;
    totalTopUp: number;
    totalRepay: number;
  };
};

const BPS = 10_000n;

/** Percent (may be fractional) to basis points. */
const pctBps = (pct: number): bigint => BigInt(Math.round(pct * 100));

function scenarioConfig(input: SimInput): { dropPct: number; steps: number; recoverPct: number } {
  if (input.scenario === "dip") {
    return { dropPct: 20, steps: 8, recoverPct: 15 };
  }
  if (input.scenario === "blackswan") {
    return { dropPct: input.crashPct ?? 55, steps: 6, recoverPct: 0 };
  }
  if (input.scenario === "custom") {
    return { dropPct: input.crashPct ?? 30, steps: input.steps ?? 10, recoverPct: 0 };
  }
  return { dropPct: input.crashPct ?? 45, steps: input.steps ?? 12, recoverPct: 0 };
}

export function simulate(input: SimInput): SimResult {
  const cfg = scenarioConfig(input);
  const totalSteps = cfg.steps + (cfg.recoverPct > 0 ? 6 : 3);

  let agent = {
    coll: input.coll,
    debt: input.debt,
    buffer: input.buffer,
    reserve: input.reserve,
  };
  const baseline = { coll: input.coll, debt: input.debt };

  const agentSteps: SimStep[] = [];
  const baselineSteps: SimStep[] = [];
  let agentLiquidated = false;
  let baselineLiquidated = false;
  let actions = 0;
  let totalTopUp = 0n;
  let totalRepay = 0n;
  let minAgent = Number(icrOf(agent.coll, agent.debt, input.price)) / 1e16;
  let minBaseline = minAgent;

  for (let t = 0; t <= totalSteps; t++) {
    let price: bigint;
    if (t <= cfg.steps) {
      price = (input.price * (BPS - (pctBps(cfg.dropPct) * BigInt(t)) / BigInt(cfg.steps))) / BPS;
    } else {
      const recSteps = BigInt(totalSteps - cfg.steps);
      const recStep = BigInt(t - cfg.steps);
      const bottomBps = BPS - pctBps(cfg.dropPct);
      const recBps = (pctBps(cfg.recoverPct) * recStep) / recSteps;
      price = (input.price * (bottomBps + recBps)) / BPS;
    }

    const baselineICR = icrOf(baseline.coll, baseline.debt, price);
    const baselineICRNum = Number(baselineICR) / 1e16;
    if (baselineICR < LIQUIDATION_ICR) baselineLiquidated = true;
    if (!baselineLiquidated) minBaseline = Math.min(minBaseline, baselineICRNum);

    let action: SimStep["action"] = "hold";
    let topUp = 0n;
    let repay = 0n;

    if (!agentLiquidated) {
      const decision = decide(
        { ...agent, price },
        input.rules,
      );
      topUp = decision.topUpAmount;
      repay = decision.repayAmount;
      if (decision.kind !== "hold") {
        action = decision.kind;
        actions += 1;
        totalTopUp += topUp;
        totalRepay += repay;
        agent = {
          ...agent,
          coll: agent.coll + topUp,
          debt: agent.debt - repay,
          buffer: agent.buffer - topUp,
          reserve: agent.reserve - repay,
        };
      }
    }

    const agentICR = icrOf(agent.coll, agent.debt, price);
    const agentICRNum = Number(agentICR) / 1e16;
    if (agentICR < LIQUIDATION_ICR) {
      agentLiquidated = true;
      action = "liquidated";
    } else {
      minAgent = Math.min(minAgent, agentICRNum);
    }

    agentSteps.push({
      t,
      price: Number(price) / 1e18,
      icr: agentICRNum,
      action,
      topUp: Number(topUp) / 1e18,
      repay: Number(repay) / 1e18,
      coll: Number(agent.coll) / 1e18,
      debt: Number(agent.debt) / 1e18,
      buffer: Number(agent.buffer) / 1e18,
      reserve: Number(agent.reserve) / 1e18,
      liquidationPrice: agent.coll > 0n ? Number((agent.debt * LIQUIDATION_ICR) / agent.coll) / 1e18 : 0,
      saved: false,
    });

    baselineSteps.push({
      t,
      price: Number(price) / 1e18,
      icr: baselineICRNum,
      action: baselineLiquidated ? "liquidated" : "hold",
      topUp: 0,
      repay: 0,
      coll: Number(baseline.coll) / 1e18,
      debt: Number(baseline.debt) / 1e18,
      buffer: 0,
      reserve: 0,
      liquidationPrice: Number(input.debt * LIQUIDATION_ICR / input.coll) / 1e18,
      saved: false,
    });
  }

  const last = agentSteps[agentSteps.length - 1];
  if (last) last.saved = !agentLiquidated && baselineLiquidated;

  return {
    scenario: input.scenario,
    startPrice: Number(input.price) / 1e18,
    endPrice: last?.price ?? Number(input.price) / 1e18,
    crashPct: cfg.dropPct,
    agentSteps,
    baselineSteps,
    summary: {
      agentLiquidated,
      baselineLiquidated,
      minICRAgent: Number(minAgent.toFixed(2)),
      minICRBaseline: Number(minBaseline.toFixed(2)),
      finalICR: Number((last?.icr ?? 0).toFixed(2)),
      actions,
      totalTopUp: Number(totalTopUp) / 1e18,
      totalRepay: Number(totalRepay) / 1e18,
    },
  };
}
