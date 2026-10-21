import assert from "node:assert/strict";
import { decide, icrOf, ONE } from "./rules.js";

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

console.log("rules tests passed");
