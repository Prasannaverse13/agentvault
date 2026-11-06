import assert from "node:assert/strict";
import { decide, icrOf, ONE } from "./rules.js";
import { repayCap } from "@agentvault/shared";

const price = 100_000n * ONE;
const rules = { triggerICR: 15n * ONE / 10n, targetICR: 2n * ONE, autoProtect: true };

const healthy = decide(
  { coll: ONE, debt: 20_000n * ONE, price, buffer: 0n, reserve: 0n },
  rules,
);
assert.equal(healthy.kind, "hold");

const crash = { coll: ONE, debt: 20_000n * ONE, price: 26_000n * ONE, buffer: ONE / 5n, reserve: 0n };
assert.equal(icrOf(crash.coll, crash.debt, crash.price), 13n * ONE / 10n);
const topUp = decide(crash, rules);
assert.equal(topUp.kind, "topUp");
assert.equal(topUp.topUpAmount, ONE / 5n);

const repay = decide({ ...crash, buffer: 0n, reserve: 5_000n * ONE }, rules);
assert.equal(repay.kind, "repay");
assert.ok(repay.projectedICR >= 17n * ONE / 10n);

const empty = decide({ ...crash, buffer: 0n, reserve: 0n }, rules);
assert.equal(empty.kind, "hold");
assert.match(empty.reason, /empty/);

const paused = decide(crash, { ...rules, autoProtect: false });
assert.equal(paused.kind, "hold");

// v2: the pooled Stability Pool reserve counts as reserve.
const pooledOnly = decide({ ...crash, buffer: 0n, reserve: 0n, pooled: 5_000n * ONE }, rules);
assert.equal(pooledOnly.kind, "repay");
assert.match(pooledOnly.reason, /Stability Pool/);

// v2: never repay below Mezo's minimum net debt (1800 + 200 gas compensation).
assert.equal(repayCap(3_000n * ONE), 1_000n * ONE);
assert.equal(repayCap(1_900n * ONE), 0n);
const small = { coll: ONE / 20n, debt: 3_000n * ONE, price: 70_000n * ONE, buffer: 0n, reserve: 3_000n * ONE };
const capped = decide(small, rules);
assert.equal(capped.repayAmount, 1_000n * ONE);
const atFloor = decide({ ...small, debt: 2_000n * ONE, price: 45_000n * ONE }, rules);
assert.equal(atFloor.kind, "hold");
assert.match(atFloor.reason, /minimum debt/);

console.log("rules tests passed");
