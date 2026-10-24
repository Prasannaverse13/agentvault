# AgentVault

**An autonomous risk agent for Bitcoin-backed MUSD loans on Mezo.**

AgentVault watches a Mezo trove 24/7. When the collateral ratio drops toward liquidation, the
agent tops up BTC collateral or repays MUSD debt *before* the loan is liquidated — using safety
funds you pre-fund inside the vault. You can talk to it in plain language, watch every decision
in a live feed, and receive Telegram alerts with the on-chain transaction.

Built for the **Mezo Buildathon — Wave 1 (DeFi track)**.

---

## Why

A BTC-backed loan has one job: survive volatility. Today the borrower has to babysit the
collateral ratio manually. A price dip becomes a liquidation, and with it the loss of the
collateral. AgentVault turns that into an automated, rule-driven, auditable process:

| | Manual | AgentVault |
|---|---|---|
| Monitoring | You, 24/7 | Agent, every 20 s |
| Reaction | After you notice | At your trigger ICR |
| Tools | Your wallet, your keys | Vault-local funds only |
| Auditability | Scrollback | Every decision + tx logged |
| Control | — | Owner kill switch, 2 powers only |

---

## Architecture

```
┌────────────────┐   HTTP/JSON   ┌──────────────────┐    viem     ┌──────────────┐
│  Next.js web   │ ────────────► │  Agent service   │ ──────────► │  Mezo testnet│
│  (chat, gauges)│ ◄──────────── │  (Fastify, TS)   │ ◄────────── │  MUSD + Trove│
└────────────────┘               └──────────────────┘             └──────────────┘
        │                                 │
        │ wallet txs                      │ telegram (optional)
        ▼                                 ▼
┌────────────────┐               ┌──────────────────┐
│ AgentVault     │               │ Telegram bot     │
│ per user vault │               │ + LLM chat (opt) │
└────────────────┘               └──────────────────┘
```

### Monorepo

| Package | What it is |
|---|---|
| `contracts/` | Solidity (Hardhat): `AgentVault`, `AgentVaultFactory`, mocks, 8 unit tests |
| `agent/` | TypeScript agent service: rules engine, monitor loop, chat, Telegram, HTTP API |
| `web/` | Next.js 15 + Tailwind dashboard: live position, chat, simulator, activity feed |
| `shared/` | Shared ABIs, Mezo testnet addresses, formatting helpers |

---

## The vault contract (the trust boundary)

Each user gets one `AgentVault` deployed by the factory. The vault owns exactly one Mezo trove.

**The owner can:**
open the loan, add/withdraw collateral, borrow more, repay, close the loan, sweep the safety
funds, change the rules, change the agent, pause the agent.

**The agent can do exactly two things** (`protect(repayAmount, topUpAmount)`):
spend the vault's MUSD reserve to repay debt, and spend the vault's BTC buffer to add collateral.

The agent **cannot** withdraw BTC, move MUSD out, change rules, or close the loan. It also cannot
act unless the owner has set `autoProtect = true` and named it as the vault's agent. The vault
caps the agent's spend to the funds that physically sit inside the vault, so a compromised agent
key can burn the safety buffer and nothing else.

Rules are validated on-chain: `triggerICR > 1.1` and `targetICR >= triggerICR`, so the agent can
never be configured to aim at a liquidation.

---

## The agent

**Rules engine** (`agent/src/rules.ts`) — deterministic, no LLM in the money path:

1. Read the trove, the on-chain BTC price, the buffer and the reserve.
2. `ICR = collateral × price / debt`; liquidation is at 110% ICR.
3. If `ICR >= triggerICR` → **hold**.
4. Otherwise compute the exact actions that restore `targetICR`:
   - `topUp = min(deficitCollateral, BTC buffer)`
   - `repay = min(deficitDebt, MUSD reserve)`
5. If both are empty → **danger alert** telling you to deposit more safety funds.

**Monitor loop** (`agent/src/monitor.ts`) — every 20 s, per watched vault, with a 60 s cooldown
between actions. Every decision, alert and transaction is written to the event store and pushed
to Telegram (when a bot token is configured).

**Chat** (`agent/src/chat.ts`) — natural language ("protect me at 60% LTV and restore to 50%").
An LLM (OpenAI-compatible endpoint) may be used, but a deterministic parser is the fallback and
the authority. The chat can only *propose* a rule change; the owner still signs the transaction
in the wallet. Chat can also trigger a stress simulation.

---

## Crash simulation — what is real and what is modelled

The Mezo oracle is not ours to move, so a genuine "BTC crashes 30% right now" event cannot be
produced on testnet. The simulator therefore models the **Mezo mechanics faithfully** (linear
price path, ICR math, the exact same `decide()` function the live agent uses, the same 110%
liquidation threshold, the same buffer/reserve caps) and compares two paths:

- **Baseline** — nobody acts. The loan liquidates when the price falls far enough.
- **Agent** — the same `decide()` rules run on every simulated price step.

The result is a side-by-side chart with the minimum ICR of each path and the exact BTC top-up /
MUSD repayment the agent would have executed. The numbers come from your real position, the real
oracle price and your real safety funds.

The **live** path is proven on-chain: the agent executes real `protect()` transactions against
the real vault, and the dashboard links the transaction hash on the Mezo explorer.

---

## Run it yourself (Mezo testnet)

```bash
pnpm install
pnpm approve-builds --all          # pnpm 11: allow keccak / secp256k1 / esbuild builds
```

1. **Fund two wallets** from https://faucet.test.mezo.org (0.05 BTC each):
   - deployer / owner
   - agent hot wallet (it needs gas to send `protect()` transactions)

2. **Configure** — copy `.env.example` to `.env` and fill in:

   ```ini
   PRIVATE_KEY=0x...          # owner / deployer
   AGENT_PRIVATE_KEY=0x...    # agent hot wallet
   TELEGRAM_BOT_TOKEN=        # optional
   TELEGRAM_CHAT_ID=          # optional
   OPENAI_API_KEY=            # optional, chat falls back to a deterministic parser
   ```

3. **Deploy the factory**

   ```bash
   pnpm --filter @agentvault/contracts deploy:testnet
   # copy FACTORY_ADDRESS into .env (and NEXT_PUBLIC_FACTORY_ADDRESS for the web app)
   ```

4. **Create a vault + open a loan + fund the safety kit**

   ```bash
   pnpm --filter @agentvault/agent exec tsx scripts/setup-demo.ts
   # prints VAULT_ADDRESS -> put it in .env
   ```

5. **Run the agent and the web app**

   ```bash
   pnpm --filter @agentvault/agent dev    # http://localhost:8787
   pnpm --filter @agentvault/web dev      # http://localhost:3000
   ```

6. **Watch it work**
   - Open the dashboard, connect the owner wallet, and you see the live ICR gauge, the agent
     decision and the event feed.
   - Open a vault whose ICR is below the trigger and the agent will spend the BTC buffer to
     restore the target ICR — a real transaction on the Mezo explorer.
   - Use the simulator to show a 45% crash: the no-agent path liquidates, the funded agent path does not. (A 35% drop is not enough: a loan at 180% ICR only falls to about 117%, above the 110% liquidation line.) Refill the vault safety funds first so the agent has ammunition.

### Demo scripts (all live on Mezo testnet)

```bash
pnpm demo:setup     # create/reuse vault, open the loan, fund the BTC buffer + MUSD reserve
pnpm demo:stress    # owner borrows more MUSD -> ICR falls below the trigger -> agent acts
pnpm demo:fund      # top up the agent wallet so it can pay for on-chain protection
```

`demo:stress` is the money shot. Live output from the run recorded below:

```
before borrowMore   ICR 180.07%  coll 0.04316 BTC  debt 2001.80 MUSD  buffer 0.00184 BTC  reserve 500.00 MUSD
Owner borrowed 400 MUSD (tx 0x7a0f5c93c4de97c3a0a5ebab40e61c32e1aa8f0173e03d916f120a8b48084d70)
after borrowMore    ICR 150.06%  coll 0.04316 BTC  debt 2402.20 MUSD  buffer 0.00184 BTC  reserve 500.00 MUSD
ICR is now 150.06% - below the 150% trigger. Waiting for the agent...

Agent acted:
after agent action  ICR 179.93%  coll 0.04500 BTC  debt 2087.14 MUSD  buffer 0.00000 BTC  reserve 184.94 MUSD
```

### Live agent transactions (Mezo testnet)

| # | Trigger | Action | ICR before → after | Tx |
|---|---|---|---|---|
| 1 | ICR 146.0% < 150% trigger | top up 0.0082 BTC | 146.0% → 180.0% | `0x07f5b01d24ceb2687f43ffb92e4efe24017eeb8c3457807cb48ed5501dca0c72` |
| 2 | owner borrowed 400 MUSD, ICR 150.0% | top up 0.0018 BTC **+** repay 315 MUSD | 150.0% → 179.9% | `0x06475c681bf031970e24c6f2e8103a3a184a148af5ca0790aa258610cef80984` |

Both are `protect()` calls on the demo vault, sent by the agent hot wallet, visible on
https://explorer.test.mezo.org.

---

## Deployed on Mezo testnet

| Contract | Address |
|---|---|
| `AgentVaultFactory` | `0x0Eb2cD465946e7eac309bCF311Dbd2Dd5cc7C31d` |
| Demo `AgentVault` | `0xAbb30839FE657D59b4CBCbB737f4af896c5a8b62` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| BorrowerOperations | `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` |
| TroveManager | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` |
| PriceFeed | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` |

Chain: `31611` · RPC `https://rpc.test.mezo.org` · Explorer `https://explorer.test.mezo.org`

---

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | agent address, chain, capabilities |
| GET | `/api/config` | chain, core addresses, factory |
| GET | `/api/status/:vault` | live position + current decision + events |
| GET | `/api/events/:vault` | event log |
| POST | `/api/simulate` | crash simulation on a real position |
| POST | `/api/demo/simulate` | crash simulation on a sample position |
| POST | `/api/chat` | natural-language rules / questions / simulate |
| POST | `/api/check/:vault` | force a protection check now |
| GET/POST/DELETE | `/api/watch` | manage watched vaults |

---

## Tests

```bash
pnpm --filter @agentvault/contracts test   # 8 passing: isolation, top-up, repay, guardrails
pnpm --filter @agentvault/agent test        # rules engine unit tests
pnpm --filter @agentvault/web build        # type-checked production build
```

---

## Wave 2 roadmap

- **Yield loop:** route the MUSD reserve into a lending market and compound the spread, so the
  safety reserve grows instead of sitting idle.
- **Cross-vault rebalancing:** move safety funds between a user's vaults so the most at-risk loan
  gets the ammunition first.
- **Hardware-agent mode:** run the guardian from a TEE/threshold signer with a time-locked
  withdrawal path, removing the single-key trust assumption entirely.
- **On-chain rules registry:** publish rules as signed messages so a new agent can take over a
  vault without owner interaction.
