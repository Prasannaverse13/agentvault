/**
 * The rules engine now lives in `@agentvault/shared` so the web dashboard can
 * mirror the agent's decision with the exact same code. This module keeps the
 * agent's internal import path stable.
 */
export {
  decide,
  icrOf,
  liquidationPrice,
  ltv,
  formatPct,
  ONE,
  LIQUIDATION_ICR,
} from "@agentvault/shared";

export type {
  Decision,
  DecisionKind,
  Position,
  Rules,
} from "@agentvault/shared";
