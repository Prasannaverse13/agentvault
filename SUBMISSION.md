# AgentVault: Mezo Buildathon Wave 1 submission pack

Copy these answers into the AKINDO form. Items marked TODO need you.

## Checklist (due Oct 26)

| Item | Status |
|---|---|
| MUSD integration | Done. Real Mezo trove via BorrowerOperations and TroveManager. MUSD reserve repays debt |
| Working deployment | Done on Mezo testnet (factory + demo vault + 2 real agent txs, re-verified on-chain) |
| Public GitHub repo | Repo is public. TODO push the latest commits (local main is ahead of origin) |
| Live project link | TODO deploy the web app (Vercel) and host the agent API somewhere reachable, set NEXT_PUBLIC_AGENT_URL |
| Project deck | TODO build from the outline below |
| 2 minute pitch video | TODO record using the script below |
| AKINDO form | Fill with the answers below |
| Mezo Discord Developer role | TODO join https://discord.mezo.org and ask for the role |

## Form answers

**Project name:** AgentVault

**Category (3-5 words):** Borrowing risk automation

**TL;DR:** An AI guardian for Bitcoin-backed MUSD loans on Mezo that tops up BTC collateral or repays MUSD debt before liquidation, using safety funds the owner pre-funds in a personal vault.

**How it works:**
A Mezo trove is liquidated at 110% ICR. Borrowers must watch the ratio all day. AgentVault gives each user a vault contract that owns one Mezo trove. The owner funds a BTC buffer and a MUSD reserve inside the vault and sets a trigger ICR and a target ICR. An agent service checks the trove and the on-chain BTC price every 20 seconds. When ICR falls below the trigger it calls protect(repayAmount, topUpAmount). The vault adds BTC collateral or repays MUSD debt so ICR returns to the target. The agent can do only these two things. It cannot withdraw BTC, move MUSD out, change rules or close the loan, so a leaked agent key can burn the safety funds and nothing else. The rules engine is deterministic with no LLM in the money path. A chat assistant (AI with a deterministic fallback) and Telegram alerts explain every decision and link the transaction. A simulator replays a BTC crash on the real position, and a risk panel shows how far BTC can fall before the agent steps in and how far it can defend. The dashboard also covers the full loan lifecycle: open, fund, borrow, repay, withdraw and close.
MUSD use: the loan itself is MUSD minted from a Mezo trove. The MUSD reserve repays debt. Deep integration with BorrowerOperations, TroveManager and the PriceFeed.

**Target group:** BTC holders who borrow MUSD on Mezo and do not want to watch the market. Beginner to mid DeFi users. Web desktop first, Telegram for alerts on mobile. Global.

**Tech stack:** Solidity (Hardhat), TypeScript, Fastify agent service, viem, Next.js 15, Tailwind, three.js, MetaMask (EIP-6963), Telegram (grammY), optional OpenAI compatible LLM for chat.

**Track:** Track 1 (DeFi: borrowing). Also fits Track 2 through Telegram alerts and a plain language chat.

**Chain deployed on:** Mezo (testnet, chain id 31611)

**Project status:** Entirely new, built during the Buildathon.

**Project readiness:** Testnet deployment

**Future milestones:**
1. Wave 2 (by Nov 15): yield loop that lends the idle MUSD reserve and compounds it, plus multi-vault support.
2. Dec 2026: security review of the vault and agent key handling, then Mezo mainnet beta.
3. Q1 2027: threshold or TEE signer for the agent, on-chain rules registry, apply to Mezo Ignition Program.

**Team:** Prasanna, solo developer and AI engineer. TODO add X or LinkedIn link.

## Proof to show judges

- Factory: 0x0Eb2cD465946e7eac309bCF311Dbd2Dd5cc7C31d
- Demo vault: 0xAbb30839FE657D59b4CBCbB737f4af896c5a8b62
- Agent tx 1 (top up, ICR 146.0% to 180.0%): 0x07f5b01d24ceb2687f43ffb92e4efe24017eeb8c3457807cb48ed5501dca0c72
- Agent tx 2 (top up and repay, ICR 150.0% to 179.9%): 0x06475c681bf031970e24c6f2e8103a3a184a148af5ca0790aa258610cef80984
- Explorer: https://explorer.test.mezo.org

## Honest scope note

The live protect path is real on Mezo testnet. The crash chart is a simulation on testnet because the Mezo oracle cannot be moved. It uses the same decide() function as the live agent. For a full end-to-end recording, `pnpm demo` runs a local demo network with mock Mezo contracts where the BTC price can be crashed on demand and the agent really sends protect() transactions. The newer owner flows (withdraw, close, reopen, multi-vault) were verified on that demo network, not on live testnet. Looping and yield compounding are Wave 2.

## 2 minute pitch video script

0:00 to 0:15 Hook. "If you borrow against Bitcoin, one bad night can liquidate you. AgentVault is a guardian that never sleeps."
0:15 to 0:35 Problem. Show the 110 percent liquidation line. Borrowers must watch ICR by hand.
0:35 to 1:00 Solution. Show the vault, the safety funds and the two rules: trigger and target. Say the agent has only two powers.
1:00 to 1:30 Live proof. Run `pnpm demo`, connect MetaMask, create a vault and click Crash 25% in Market control (or run the testnet stress demo). Show ICR drop under 150 percent, the agent transaction, and ICR back near 180 percent. Open the explorer link.
1:30 to 1:50 Crash simulator at minus 45 percent. Red line liquidates. Green line survives.
1:50 to 2:00 Close. "Built on MUSD and Mezo. Next: yield on the reserve and mainnet." Show repo and links.

## Deck outline (8 slides)

1. Title and one line pitch
2. Problem: liquidation risk and 24/7 watching
3. Solution: vault plus guardian agent
4. How it works: architecture diagram (web, agent, vault, Mezo trove)
5. Trust model: the agent has only two powers
6. Live proof: two testnet transactions with ICR before and after
7. Why Mezo and MUSD: depth of integration, track fit
8. Roadmap: Wave 2 yield loop, mainnet, team
