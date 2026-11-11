# AgentVault: Mezo Buildathon Wave 2 submission pack

Wave 2 deadline on AKINDO: **Nov 13, 11:00**. Copy these answers into the AKINDO form.

## Checklist

| Item | Status |
|---|---|
| Judge feedback addressed (Stability Pool reserve, claimCollateral, min debt cap, verify, deck, revenue) | Done in code, 23 contract tests + 20 end-to-end checks passing |
| Deploy v2 factory on Mezo testnet | Done: [0xe211B90736A3995e4C57f560724C265d5C60C538](https://explorer.test.mezo.org/address/0xe211B90736A3995e4C57f560724C265d5C60C538) (built for the london EVM so the explorer can read it) |
| Verify factory on explorer.test.mezo.org | Not done: every method fails with Unable to verify although the deployed bytecode matches the local build byte for byte. Do not claim verified. |
| Wave 2 proof transactions | Done, see Proof on Mezo testnet below |
| Verify the demo vault | Not done, same explorer problem |
| Update Render env (`FACTORY_ADDRESS`, `NEXT_PUBLIC_FACTORY_ADDRESS`, `AGENT_VAULTS`) and redeploy | Done |
| Push to GitHub (repo must stay public) | Done, merged into main |
| Pitch deck | Linked on AKINDO |
| Launch video | Done: https://youtu.be/vibWPnAekEE |
| Team info with X or LinkedIn | TODO |

## Updates in this Wave (AKINDO box, under 3000 characters)

```
Wave 2 answers every point from the Wave 1 review, and delivers our declared Wave 2 goals: the idle MUSD reserve now earns and compounds into the loan, and one owner can run many vaults. The on-chain rules registry moves to Wave 3.

1. The MUSD reserve now earns. Idle reserve goes into the Mezo Stability Pool (provideToSP) and earns BTC from liquidations. When the loan is in danger, protect() pulls just the missing MUSD back out (withdrawFromSP) and repays. harvest() adds the BTC gains to the trove as collateral, so the loan protects itself with its own yield. The agent keeps 30% liquid and pools the rest by itself. Mezo blocks pool withdrawals while any trove is under 110%; protect() catches that and falls back to the liquid reserve and BTC buffer instead of reverting.

2. Redemption surplus (the High finding). claimSurplus() calls BorrowerOperations.claimCollateral() and sends the BTC to the owner. The agent calls it automatically after a redemption.

3. Min debt cap. maxRepay() = debt - 200 MUSD gas compensation - minNetDebt. protect() clamps to it on-chain and the rules engine never asks for more, so a rescue cannot revert at Mezo's 1800 MUSD floor.

4. Revenue model. 0.5% of each rescue and 10% of Stability Pool gains, to a treasury fixed at deploy. Hard caps in the contract (1% and 20%). A failing fee transfer never blocks a rescue.

5. A pitch deck and a launch video. Explorer verification: we rebuilt for the london EVM and the deployed bytecode matches our build byte for byte, but Mezo's verifier still answers Unable to verify, so the contracts are not verified yet.

Also: agent writes carry a gas margin because Mezo's trove list search costs 6M+ gas on testnet (found when a live rescue ran out of gas), closeLoan() unwinds the pool to pay the debt, the agent serializes its transactions (fixed a nonce race), a new Earn card in the dashboard, the chat explains Earn and fees. Wave 1 vaults keep working.

Tests: 23 contract tests (8 in Wave 1), 20 end-to-end checks on a live local chain with the real agent, all passing.

Proof on Mezo testnet:
Factory v2: https://explorer.test.mezo.org/address/0xe211B90736A3995e4C57f560724C265d5C60C538
Demo vault: https://explorer.test.mezo.org/address/0x17f31926284BB7e36b272eCdd250fBfD3059366E
420 MUSD into the Stability Pool: https://explorer.test.mezo.org/tx/0x1dd44969f5b5955c464312fe9c61ec99b4e61793cf59055ea340b0270484b89f
Owner borrows more, ICR drops to 118.7%: https://explorer.test.mezo.org/tx/0x4fea2ac39bb9d86db01e271bff1d67ffc2e1cdc0545c5bc7a1b511ce077f1355
Agent rescue that unwinds the pool, ICR 118.9% to 140.0%, pool 420 to 249.6 MUSD: https://explorer.test.mezo.org/tx/0x3b9d40dd6d96248b563fce7a0d1d8ab3aca7668dbe347f33d2061a9cc4b0d389
Live app: https://agentvault-90fz.onrender.com/
Code: https://github.com/Prasannaverse13/agentvault
Video: https://youtu.be/vibWPnAekEE
```

## Milestones

**3rd Wave**
```
Mezo Pools liquidity as a second Earn venue with a smart split between the Stability Pool and Pools. MEZO token fee discounts for holders. Cross-vault rebalancing that sends safety funds to the most at-risk vault first. Telegram commands to fund, pause and harvest.
```

**After the Buildathon**
```
Independent security review of the vault and agent key handling, a threshold or TEE signer for the agent, then a Mezo mainnet beta and an application to the Mezo Ignition Program.
```

## Form answers

**Project name:** AgentVault

**Category (3-5 words):** Borrowing protection and yield

**TL;DR:** An AI guardian for Bitcoin-backed MUSD loans on Mezo that keeps your safety reserve earning in the Mezo Stability Pool and spends it to repay debt or add BTC before liquidation.

**How it works:**
A Mezo trove is liquidated at 110% ICR, so borrowers must watch their ratio all day, and the MUSD they set aside for emergencies earns nothing. AgentVault gives each user a vault contract that owns one Mezo trove. The owner funds a BTC buffer and a MUSD reserve and sets a trigger and a target ICR. The reserve works in the Mezo Stability Pool, earning BTC from liquidations, and those gains are harvested into the loan as collateral. An agent checks the trove and Mezo's price feed every 20 seconds. Below the trigger it calls protect(): the vault pulls MUSD out of the pool, repays debt and adds BTC so ICR returns to the target. Repays respect Mezo's minimum debt, and after a redemption the agent claims the surplus BTC for the owner. The agent can never withdraw funds, change rules or close the loan. The rules engine is deterministic with no LLM in the money path; a chat assistant and Telegram alerts explain every action.
MUSD use: the loan is MUSD from a Mezo trove (BorrowerOperations, TroveManager, PriceFeed). The MUSD reserve sits in the Mezo StabilityPool, backing Mezo's liquidation engine, and is unwound to repay. claimCollateral recovers redemption surplus.

**Target group:** BTC holders who borrow MUSD on Mezo and do not want to watch the market all day. Beginner to mid DeFi users. Desktop web first, Telegram alerts on mobile. Global.

**Tech stack:** Solidity 0.8.24 (Hardhat, OpenZeppelin), TypeScript, Fastify, viem, Next.js 15, Tailwind, Telegram (grammY), optional OpenAI compatible LLM for chat, Render.

**Track:** Track 1 (DeFi: borrowing and yield). Also Track 2 (Telegram alerts, plain language chat).

**Chain deployed on:** Mezo (testnet, chain id 31611)

**Project status:** Built during the Buildathon. Wave 2 extends the Wave 1 product.

**Project readiness:** Testnet deployment

**Team info:** Prasanna, solo developer and AI engineer. <ADD X OR LINKEDIN>

## Proof

Wave 2 (fill from `contracts/deployments/31611.json` and `wave2-proof.json`):

| What | Link |
|---|---|
| v2 factory | https://explorer.test.mezo.org/address/0xe211B90736A3995e4C57f560724C265d5C60C538 |
| v2 demo vault | https://explorer.test.mezo.org/address/0x17f31926284BB7e36b272eCdd250fBfD3059366E |
| Stability Pool deposit (earnDeposit) | https://explorer.test.mezo.org/tx/0x1dd44969f5b5955c464312fe9c61ec99b4e61793cf59055ea340b0270484b89f |
| Stress: owner borrows more | https://explorer.test.mezo.org/tx/0x4fea2ac39bb9d86db01e271bff1d67ffc2e1cdc0545c5bc7a1b511ce077f1355 |
| Agent protect() that unwinds the pool | https://explorer.test.mezo.org/tx/0x3b9d40dd6d96248b563fce7a0d1d8ab3aca7668dbe347f33d2061a9cc4b0d389 |

Wave 1:
- Factory: 0x0Eb2cD465946e7eac309bCF311Dbd2Dd5cc7C31d
- Demo vault: 0xAbb30839FE657D59b4CBCbB737f4af896c5a8b62
- Agent tx 1 (top up, ICR 146.0% to 180.0%): 0x07f5b01d24ceb2687f43ffb92e4efe24017eeb8c3457807cb48ed5501dca0c72
- Agent tx 2 (top up and repay, ICR 150.0% to 179.9%): 0x06475c681bf031970e24c6f2e8103a3a184a148af5ca0790aa258610cef80984

## Honest scope note

Stability Pool gains only appear when a real liquidation happens on Mezo testnet, and a redemption
cannot be forced cheaply. Harvest and surplus claim are proven by contract tests against mocks that
follow Mezo's code (including the rule that blocks pool withdrawals while a trove sits below 110%);
the deposit, unwind-on-rescue and capped repay are proven on testnet.

## 2 minute video script (Wave 2)

0:00 to 0:12 Hook. "In Wave 1 AgentVault saved loans. In Wave 2 the safety money earns while it waits."
0:12 to 0:35 Earn card. Reserve split: 70% in the Mezo Stability Pool, 30% liquid. BTC earned from liquidations goes straight into the loan.
0:35 to 1:05 Live rescue. Borrow more, ICR drops under the trigger, the agent unwinds the pool and repays. Show the tx on the explorer.
1:05 to 1:25 Safety. Repay cap at Mezo's minimum debt. Redemption surplus claimed for the owner. Agent can never withdraw.
1:25 to 1:45 Business. 0.5% per rescue, 10% of pool gains, capped on-chain. More deposits in Mezo's Stability Pool, fewer liquidations.
1:45 to 2:00 Close. 23 tests, real testnet txs, links.
