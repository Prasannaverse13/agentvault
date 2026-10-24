# AgentVault

**An autonomous guardian for Bitcoin-backed MUSD loans on Mezo.**

AgentVault gives every borrower a personal vault contract that owns one Mezo trove. The owner
pre-funds a BTC buffer and a MUSD reserve inside the vault and sets two numbers: *when to act*
(trigger ICR) and *where to restore to* (target ICR). An agent service watches the trove and the
on-chain BTC price. When the collateral ratio falls below the trigger it calls `protect()`, and the
vault adds BTC collateral or repays MUSD debt so the loan never reaches the 110% liquidation line.

The agent has exactly two powers (add collateral, repay debt) and can only spend what already sits
inside the vault. It cannot withdraw, move MUSD out, change rules or close the loan.

Built for the **Mezo Buildathon, Wave 1 (Track 1: DeFi, with Track 2 Telegram access)**.

| | |
|---|---|
| Chain | Mezo testnet, chain id `31611` (plus a local demo network, chain id `31337`) |
| MUSD integration | Real Mezo trove via `BorrowerOperations` and `TroveManager`; MUSD reserve repays debt |
| Live contracts | Factory `0x0Eb2cD465946e7eac309bCF311Dbd2Dd5cc7C31d`, demo vault `0xAbb30839FE657D59b4CBCbB737f4af896c5a8b62` |
| Proof | Two agent `protect()` transactions on testnet, see [Live proof](#live-proof-on-mezo-testnet) |
| Stack | Solidity (Hardhat), TypeScript, Fastify, viem, Next.js 15, Tailwind, three.js, grammY |

---

## Table of contents

1. [The problem](#1-the-problem)
2. [Mezo and MUSD integration](#2-mezo-and-musd-integration)
3. [System architecture](#3-system-architecture)
4. [Smart contracts](#4-smart-contracts)
5. [Agent service](#5-agent-service)
6. [Web application](#6-web-application)
7. [Networks: Mezo testnet and the demo network](#7-networks-mezo-testnet-and-the-demo-network)
8. [Getting started](#8-getting-started)
9. [Configuration reference](#9-configuration-reference)
10. [HTTP API reference](#10-http-api-reference)
11. [Testing](#11-testing)
12. [Security model](#12-security-model)
13. [Known limitations](#13-known-limitations)
14. [Live proof on Mezo testnet](#live-proof-on-mezo-testnet)
15. [Buildathon fit](#15-buildathon-fit)
16. [Roadmap](#16-roadmap)
17. [Repository layout](#17-repository-layout)

---

## 1. The problem

A Mezo trove is liquidated when its individual collateral ratio (ICR) falls to **110%**. The
borrower has to watch the ratio around the clock. One bad night turns a price dip into a
liquidation and the loss of the collateral.

| | Manual | AgentVault |
|---|---|---|
| Monitoring | You, 24/7 | Agent, every 20 s (3 s on the demo network) |
| Reaction | After you notice | At your trigger ICR |
| What can move funds | Your wallet, your keys | Vault-local safety funds only |
| Auditability | Scrollback | Every decision and transaction logged and exportable |
| Control | Everything, all the time | Owner kill switch, two agent powers only |

---

## 2. Mezo and MUSD integration

AgentVault does not wrap or mock Mezo on testnet. Each vault **is** a Mezo borrower: the vault
contract is the trove owner and talks to the protocol directly.

| Mezo contract | Functions the vault or agent uses | Why |
|---|---|---|
| `BorrowerOperations` | `openTrove`, `addColl`, `withdrawColl`, `withdrawMUSD`, `repayMUSD`, `closeTrove`, `minNetDebt`, `getBorrowingFee` | Open, defend, adjust and close the loan |
| `TroveManager` | `getTroveColl`, `getTroveDebt`, `getTroveStatus`, `getCurrentICR` | Read the live position and the exact ICR Mezo uses |
| `PriceFeed` | `fetchPrice` | The same oracle price that decides liquidation |
| `MUSD` (ERC-20) | `balanceOf`, `approve`, `transfer`, `transferFrom` | Borrowed asset, and the reserve that repays debt |

How MUSD is used:

1. The loan is MUSD minted from a Mezo trove.
2. The **MUSD reserve** held in the vault is spent by the agent to repay debt (`repayMUSD`).
3. The **BTC buffer** is spent to add collateral (`addColl`).
4. The agent compares against Mezo's own `getCurrentICR`, so the decision matches what the
   liquidation engine will see.

Composability: AgentVault sits on top of an existing Mezo product (Mezo Borrow) and extends it
with automation, rather than being a standalone app. The vault is a normal contract, so other
protocols can hold, read or wrap it.

---

## 3. System architecture

### 3.1 Components

```mermaid
flowchart LR
  subgraph Browser
    UI["Next.js web app<br/>dashboard, chat, simulator"]
    MM["MetaMask<br/>(EIP-6963)"]
  end

  subgraph Agent["Agent service (Fastify + TypeScript)"]
    API["HTTP API"]
    MON["Monitor loop<br/>every 20 s"]
    RULES["Rules engine<br/>decide()"]
    SIM["Simulator + risk"]
    CHAT["Chat<br/>LLM + rule parser"]
    STORE[("Event + history store<br/>JSON files")]
    TG["Telegram bot"]
  end

  subgraph Mezo["Mezo testnet"]
    FACTORY["AgentVaultFactory"]
    VAULT["AgentVault<br/>(one per user)"]
    BO["BorrowerOperations"]
    TM["TroveManager"]
    PF["PriceFeed"]
    MUSD["MUSD token"]
  end

  UI -- "REST" --> API
  UI -- "owner transactions" --> MM
  MM -- "signs" --> VAULT
  MM -- "createVault" --> FACTORY
  FACTORY -- "deploys" --> VAULT
  MON --> RULES
  API --> RULES
  API --> SIM
  API --> CHAT
  MON -- "protect(repay, topUp)" --> VAULT
  VAULT --> BO
  VAULT --> TM
  VAULT --> PF
  BO --> MUSD
  MON -- "reads" --> VAULT
  MON --> STORE
  MON --> TG
  CHAT -. "optional" .-> LLM["OpenAI-compatible LLM"]
  UI -. "fallback: direct chain reads" .-> VAULT
```

The web app reads from the agent for history, risk and chat, and **falls back to reading the vault
straight from the chain** (with the same shared rules engine) when the agent is unreachable, so
the dashboard never shows a different truth than the contract.

### 3.2 One protection cycle

```mermaid
sequenceDiagram
  autonumber
  participant Mon as Monitor loop
  participant Vault as AgentVault
  participant Mezo as Mezo (TroveManager, BorrowerOps)
  participant Oracle as PriceFeed
  participant Owner as Owner (web / Telegram)

  loop every poll interval
    Mon->>Vault: health()
    Vault->>Oracle: fetchPrice()
    Vault->>Mezo: getTroveColl / getTroveDebt / getCurrentICR
    Vault-->>Mon: coll, debt, price, icr, buffer, reserve
    Mon->>Mon: decide(position, rules)
    alt ICR >= trigger
      Mon->>Mon: hold, record history point
    else ICR < trigger and safety funds available
      Mon->>Vault: protect(repayAmount, topUpAmount)
      Vault->>Mezo: repayMUSD(...) and addColl(...)
      Vault-->>Mon: AgentAction(kind, price, icrBefore, icrAfter)
      Mon->>Owner: toast, Telegram message, activity feed entry
    else ICR < trigger and safety funds empty
      Mon->>Owner: danger alert, deposit BTC buffer or MUSD reserve
    end
  end
```

### 3.3 Roles and what each can do

```mermaid
flowchart TB
  O["Owner wallet"] -->|"open, add, withdraw, borrow, repay,<br/>close, sweep funds, set rules, set agent, pause"| V["AgentVault"]
  A["Agent hot wallet"] -->|"protect(repayAmount, topUpAmount) only,<br/>capped to vault funds, only if autoProtect"| V
  X["Anyone"] -->|"addCollateral() or send BTC to the vault"| V
  V -->|"owns exactly one trove"| T["Mezo trove"]
```

### 3.4 Screens in the web app

```mermaid
stateDiagram-v2
  [*] --> Landing
  Landing --> Dashboard: connect wallet and open vault
  Landing --> NoVault: connected, no vault yet
  NoVault --> Dashboard: create vault
  Dashboard --> Dashboard: switch vault, open loan, close loan
  Dashboard --> Landing: disconnect wallet or logo
  NoVault --> Landing: disconnect wallet
```

---

## 4. Smart contracts

Solidity 0.8.24, OpenZeppelin 5, Hardhat. Source in [`contracts/contracts`](contracts/contracts).

### 4.1 `AgentVaultFactory`

Deploys one isolated `AgentVault` per call and indexes them by owner.

| Function | Description |
|---|---|
| `createVault(agent, triggerICR, targetICR)` | Deploys a vault owned by `msg.sender`, `autoProtect = true` |
| `getVaults(owner)` | All vaults of an owner |
| `vaultCount()` | Total vaults |
| Event `VaultCreated(owner, vault, agent)` | Indexed for discovery |

### 4.2 `AgentVault`

| Function | Caller | What it does |
|---|---|---|
| `openLoan(debt)` payable | owner | Opens the Mezo trove with `msg.value` as collateral and sends the minted MUSD to the owner |
| `addCollateral()` payable | anyone | Adds BTC to the trove (anyone may top a vault up) |
| `repay(amount)` | owner | Pulls MUSD from the owner and repays debt |
| `borrowMore(amount)` | owner | Borrows more MUSD to the owner |
| `withdrawCollateral(amount)` | owner | Takes collateral out of the trove to the owner |
| `closeLoan()` | owner | Closes the trove and returns all BTC held by the vault |
| `fundReserve(amount)` | owner | Moves MUSD into the vault as the agent's reserve |
| `sweepMUSD(to, amount)` / `sweepBTC(to, amount)` | owner | Takes unused safety funds back out |
| `setRules(trigger, target, autoProtect)` | owner | Updates the rules and the kill switch |
| `setAgent(agent)` | owner | Rotates the agent address |
| `protect(repayAmount, topUpAmount)` | **agent** | Repays from the MUSD reserve and/or adds BTC from the buffer |
| `health()` | view | `coll, debt, price, icr, status, btcBuffer, musdReserve` |
| `liquidationPrice()` | view | BTC price at which ICR hits 110% |
| `receive()` | anyone | Plain BTC transfers become the BTC buffer |

Events: `LoanOpened`, `CollateralAdded`, `CollateralWithdrawn`, `DebtRepaid`, `Borrowed`,
`BufferFunded`, `ReserveFunded`, `RulesUpdated`, `AgentChanged`, `AgentAction`, `LoanClosed`.

### 4.3 Invariants enforced on-chain

- `triggerICR > 110%` and `targetICR >= triggerICR` and `targetICR <= 1000%`, so the agent can
  never be configured to aim at liquidation.
- `protect()` requires `msg.sender == agent`, `autoProtect == true` and an active trove.
- `protect()` clamps `repayAmount` to the MUSD held by the vault and `topUpAmount` to the BTC held
  by the vault. The agent can never spend funds that are not already inside the vault.
- All state-changing paths that move value are `nonReentrant`.

### 4.4 Mocks (tests and demo network only)

`MockPriceFeed`, `MockMUSD`, `MockTroveManager`, `MockBorrowerOperations` mirror the Mezo
interface the vault uses. They back the unit tests and the [demo network](#7-networks-mezo-testnet-and-the-demo-network).
The mock price feed exposes `setPrice`, which is what makes a real, on-chain "BTC crashes 25%"
demo possible.

---

## 5. Agent service

TypeScript, Fastify 5, viem, in [`agent/src`](agent/src).

| Module | Responsibility |
|---|---|
| `rules.ts` / `shared/src/rules.ts` | The single `decide()` function (shared with the web app) |
| `monitor.ts` | Per-vault check, executes `protect()`, 60 s cooldown, danger alerts (5 min cooldown) |
| `chain.ts` | viem clients, `readVault`, `protectVault`, state-based transaction confirmation |
| `simulator.ts` | Crash replay: agent path vs no-agent path |
| `risk.ts` | Risk score and survivable-drop analysis |
| `chat.ts` | LLM chat with a deterministic rule parser as fallback |
| `telegram.ts` | Bot commands and alert delivery |
| `store.ts`, `history.ts`, `watchlist.ts` | JSON persistence for events, health history and watched vaults |
| `demo.ts` | Demo network only: faucet and movable oracle |
| `server.ts` | HTTP API |

### 5.1 Rules engine

Deterministic, no LLM in the money path. ICR uses `1e18 = 100%`.

```
ICR        = coll * price / debt
hold       if debt == 0, or autoProtect is off, or ICR >= triggerICR

targetColl = debt * targetICR / price
topUp      = min( max(targetColl - coll, 0), BTC buffer )

collAfter  = coll + topUp
targetDebt = collAfter * price / targetICR
repay      = min( max(debt - targetDebt, 0), MUSD reserve )

projected  = (coll + topUp) * price / (debt - repay)
```

If both `topUp` and `repay` come out zero while the loan is below the trigger, the engine returns
a **danger** state: the loan is at risk and the safety funds are empty.

### 5.2 Monitor loop

Every `AGENT_POLL_MS` (20 s by default) for each watched vault: read the vault, run `decide()`,
and if the decision is not `hold`, the agent is authorised on that vault, and the cooldown has
elapsed, send `protect(repay, topUp)`. Confirmation is **state-based** (it waits for collateral to
rise or debt to fall) because the public testnet RPC is unreliable for receipts. Every outcome is
written to the event store and sent to Telegram when configured. After each check a health point
is recorded for the dashboard chart.

### 5.3 Simulator and risk analysis

`POST /api/simulate` replays a price path against the **real** position, real oracle price and real
safety funds, with and without the agent, using the exact `decide()` function.

| Scenario | Path |
|---|---|
| `crash` | -45% over 12 steps |
| `dip` | -20% over 8 steps, then +15% recovery |
| `blackswan` | -55% over 6 steps |
| `custom` | `crashPct` and `steps` supplied by the caller |

`GET /api/risk/:vault` runs a bisection over straight-line crashes to find the deepest BTC drop the
agent can still defend, and reports distance to the trigger, distance to liquidation, safety-fund
coverage of the debt, and a 0 to 100 risk score (lower is safer).

### 5.4 Chat and AI

The chat accepts plain language ("protect me at 60% LTV and restore to 50%", "run a crash test",
"pause protection").

- With `OPENAI_API_KEY` set it calls an OpenAI-compatible `chat/completions` endpoint with the live
  position and rules as context and requires a strict JSON reply: `reply`, `rulePatch`, `simulate`.
- The reply is validated: ICR values must be sane and `target >= trigger`, otherwise the patch is
  dropped. It retries once with minimal parameters for models that reject JSON mode.
- If the model is unreachable or rejects the request, a deterministic regex parser answers instead,
  and the response carries a `notice` explaining why. The UI labels every answer "AI answer" or
  "Built-in rules".
- The chat can only **propose** a rule change. The owner signs it in their wallet.

### 5.5 Telegram (Track 2 access)

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. The bot sends an alert with the transaction hash
whenever the agent acts, and a warning when safety funds run out. Commands: `/start`, `/help`,
`/status [vault]`, `/simulate crash|dip|blackswan`, and free text goes through the chat.

---

## 6. Web application

Next.js 15 (App Router), React 19, Tailwind 3, viem. Design follows a flat Forest-Ink and
Lime-Voltage system with pill controls. Source in [`web`](web).

### 6.1 Wallet layer (`lib/useWallet.ts`)

- Finds **MetaMask specifically** through EIP-6963, even when another wallet owns `window.ethereum`.
- Restores an approved session silently on reload; Disconnect clears it and revokes permission.
- Adds or switches to the right network automatically.
- Every transaction goes through `requireClient()`, which re-checks the network first.
- Friendly errors (rejected request, pending request, wrong network).
- Disconnecting from the app **or from MetaMask itself** returns the user to the landing page.

### 6.2 Landing page

Marketing only: headline, how it works, the "defend, never drain" trust model, and a live 3D coin
background (three.js) that responds to scrolling and the mouse. It respects reduced-motion settings
and renders nothing if WebGL is unavailable. No product tools are exposed before connecting.

### 6.3 Dashboard

| Area | What it provides |
|---|---|
| Setup checklist | Loan, BTC buffer, MUSD reserve and armed agent, derived from the live position |
| Position and agent decision | ICR gauge, collateral, debt, liquidation price, what the agent will do next |
| Risk insight | Risk score, drop to trigger, drop to liquidation, drop the agent can defend |
| Health history | ICR over time, restore target, trigger and 110% lines, every agent action marked |
| Simulator | Replay a crash against your own position, agent vs no agent |
| Protection rules | Trigger and restore-to LTV sliders, auto-protect switch, signed by the owner |
| Actions | Buffer, reserve, borrow, repay, withdraw (buffer, reserve, collateral with a safety margin) |
| Close loan | Repays from the reserve (tops it up first if short) and returns the BTC |
| Agent chat | Natural-language rules and questions, with the AI/rules label |
| Activity | Filter by actions and alerts, export CSV |
| Alerts | In-app toasts when the agent acts, Telegram status and a test button |
| Vault details | Addresses with copy and explorer links, danger zone |
| Multi-vault | Switch between vaults, create more, reopen a loan on a closed vault |

---

## 7. Networks: Mezo testnet and the demo network

The network is chosen by one switch: `NETWORK=local` for the agent and `NEXT_PUBLIC_NETWORK=local`
for the web app (default is Mezo testnet). The shared package (`shared/src/addresses.ts`) resolves
chain id, RPC, explorer and the core contract addresses accordingly.

| | Mezo testnet (default) | Demo network (`pnpm demo`) |
|---|---|---|
| Chain id | 31611 | 31337 (local hardhat node) |
| Mezo contracts | The real deployed protocol | Mock Mezo contracts at fixed addresses |
| Funds | Faucet | Free, one click ("Get 100 demo BTC") |
| BTC price | Real oracle, cannot be moved | Movable from the dashboard |
| Agent poll | 20 s | 3 s |
| Purpose | Real deployment and proof | Full end-to-end demo and recording |

```mermaid
flowchart LR
  RUN["pnpm demo<br/>scripts/demo.mjs"] --> CHAIN["hardhat node :8545<br/>chain id 31337"]
  RUN --> DEPLOY["deploy-local.ts<br/>mocks + factory at fixed addresses"]
  RUN --> AGENT["agent :8787<br/>NETWORK=local, 3 s poll"]
  RUN --> WEB["web :3000<br/>NEXT_PUBLIC_NETWORK=local"]
  DEPLOY --> CHAIN
  AGENT --> CHAIN
  WEB -->|"MetaMask txs"| CHAIN
  WEB -->|"Market control, demo faucet"| AGENT
  AGENT -->|"setPrice (admin key)"| CHAIN
```

Why a demo network exists: Mezo testnet BTC is scarce and the real oracle cannot be moved, so a
genuine "BTC crashes 25% right now" cannot be produced there. On the demo network every action
is a real transaction signed by MetaMask, the agent really sends `protect()`, and the price can
be crashed on demand. Contract addresses are deterministic because the deploy script uses a
fresh node and a fixed deployer; the script aborts if they ever differ from `shared`.

---

## 8. Getting started

**Prerequisites:** Node 22+, pnpm 11, MetaMask in your browser.

```bash
pnpm install
pnpm approve-builds --all     # pnpm 11: allow keccak, secp256k1, esbuild
```

### 8.1 Run the full demo (recommended, no faucet needed)

```bash
pnpm demo
```

This starts the chain, deploys the mocks and factory, starts the agent and the web app, then
prints the URLs. Open http://localhost:3000 and:

1. **Connect MetaMask.** The app adds the "AgentVault Demo Network" and sends your wallet 100 demo BTC.
2. **Create a vault, open a loan, fund a BTC buffer and a MUSD reserve.** The checklist guides you.
3. **Crash the market** with the *Market control* card (-10% / -25% / -40%). The agent sends a real
   `protect()` transaction within seconds and a toast reports what it did.
4. Watch Risk insight, Health history and the Activity feed update. Try Withdraw and Close loan.

If MetaMask reports nonce errors after you restart the demo chain: *Settings, Advanced, Clear
activity tab data*. Demo data lives in `data-demo/` and never touches testnet data.

### 8.2 Run against Mezo testnet

1. **Fund two wallets** at https://faucet.test.mezo.org: an owner/deployer and an agent hot wallet
   (it needs gas to send `protect()`).
2. **Configure:** `cp .env.example .env`, then set `PRIVATE_KEY` and `AGENT_PRIVATE_KEY`
   (optionally Telegram and OpenAI keys).
3. **Deploy the factory:**
   ```bash
   pnpm --filter @agentvault/contracts deploy:testnet
   # put FACTORY_ADDRESS and NEXT_PUBLIC_FACTORY_ADDRESS in .env
   ```
4. **Run the agent and the web app:**
   ```bash
   pnpm agent:dev      # http://localhost:8787
   pnpm web:dev        # http://localhost:3000
   ```
5. Connect MetaMask (Mezo Testnet is added automatically), create a vault and open a loan from the UI,
   or use the scripts below.

### 8.3 Scripts

| Command | What it does |
|---|---|
| `pnpm demo` | Whole product on the local demo network |
| `pnpm demo:setup` | Testnet: create or reuse a vault, open the loan, fund buffer and reserve |
| `pnpm demo:stress` | Testnet: owner borrows more so ICR falls below the trigger, then waits for the agent |
| `pnpm demo:fund` | Testnet: top up the agent wallet's gas |
| `pnpm demo:transfer` | Testnet: send BTC between the project wallets |
| `pnpm contracts:test` | Contract unit tests |
| `pnpm --filter @agentvault/agent test` | Rules engine tests |
| `pnpm --filter @agentvault/agent e2e:local` | End-to-end check against a running `pnpm demo` |
| `pnpm typecheck` | Shared, agent and web (production build) |

---

## 9. Configuration reference

All variables are read from `.env` at the repository root (agent) and the process environment (web).

| Variable | Default | Purpose |
|---|---|---|
| `PRIVATE_KEY` | | Owner / deployer key (testnet scripts, contract deploy) |
| `AGENT_PRIVATE_KEY` | `PRIVATE_KEY` | Agent hot wallet that sends `protect()` |
| `FACTORY_ADDRESS` | | `AgentVaultFactory` address |
| `VAULT_ADDRESS` / `AGENT_VAULTS` | | Vaults to watch from boot (comma separated) |
| `MEZO_TESTNET_RPC` | `https://rpc.test.mezo.org` | Chain RPC |
| `AGENT_PORT` | `8787` | Agent HTTP port |
| `AGENT_POLL_MS` | `20000` | Monitor interval |
| `AGENT_EXECUTE` | `true` | Set `false` for dry-run (decide and log, never send) |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Link used in Telegram messages |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | | Enable Telegram alerts and bot |
| `OPENAI_API_KEY` | | Enables the AI chat |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat model |
| `NEXT_PUBLIC_AGENT_URL` | `http://localhost:8787` | Agent URL for the web app |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | | Factory address for the web app |
| `NETWORK` / `NEXT_PUBLIC_NETWORK` | `testnet` | `local` selects the demo network |
| `DATA_DIR` | `../data` | Where events, history and the watchlist are stored |
| `DEMO_ADMIN_KEY` | | Demo network only: key that moves the mock oracle |

---

## 10. HTTP API reference

Base URL `http://localhost:8787`. JSON in and out. Errors are `{ "error": string }`.

| Method | Route | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | | agent address, chain, `execute`, watched vaults, `telegram`, `llm`, `llmModel`, `demo`, `pollMs` |
| GET | `/api/config` | | chain, core addresses, factory, agent, `demo` |
| GET | `/api/status/:vault` | | `position` (live view), `decision`, last 25 `events` |
| GET | `/api/events/:vault?limit=` | | `events[]` |
| GET | `/api/history/:vault?limit=` | | `points[]` (`t, price, icr, coll, debt, buffer, reserve`) |
| GET | `/api/risk/:vault` | | risk score, band, `dropToTrigger`, `dropToLiquidation`, `survivableDropWithAgent`, coverage |
| POST | `/api/simulate` | `{ vault, scenario, crashPct?, steps? }` | `agentSteps[]`, `baselineSteps[]`, `summary` |
| POST | `/api/demo/simulate` | `{ scenario }` | Simulation on a sample position |
| POST | `/api/chat` | `{ vault, message }` | `{ reply, rulePatch, simulate, source, notice? }` |
| POST | `/api/check/:vault` | | Force a protection check now |
| GET / POST / DELETE | `/api/watch`, `/api/watch/:vault` | `{ vault }` | Manage the watchlist (agent must be authorised on the vault) |
| POST | `/api/notify/test` | | `{ configured, sent }` Telegram test |
| GET | `/api/demo/market` | | Demo network only: `{ price, startPrice }` |
| POST | `/api/demo/price` | `{ price }` or `{ changePct }` or `{ reset: true }` | Demo network only: move the mock oracle |
| POST | `/api/demo/faucet` | `{ address, amount? }` | Demo network only: give a wallet free BTC |

---

## 11. Testing

| Suite | Command | Covers |
|---|---|---|
| Contracts (8 tests) | `pnpm contracts:test` | Vault isolation per owner, open loan, agent top-up on crash, agent repay on crash, agent-only and kill switch, rule bounds, owner-only actions, close loan |
| Rules engine | `pnpm --filter @agentvault/agent test` | Hold, top-up, repay, empty safety funds, paused agent |
| End to end (14 checks) | `pnpm demo` then `pnpm --filter @agentvault/agent e2e:local` | Signs real transactions with a fresh wallet: faucet, create vault, open loan, fund, risk report, crash the oracle, the agent executes `protect()` on-chain, ICR restored, history recorded, rule update, withdraw buffer, close loan |
| Type and build | `pnpm typecheck` | Shared, agent, and the Next.js production build |

The dashboard was additionally driven end to end in a browser against the demo network (connect,
create vault, open loan, fund, crash, agent protects, withdraw, close, reopen, multi-vault).

---

## 12. Security model

| Threat | Mitigation |
|---|---|
| Agent key leaked | The agent can only call `protect()`, which only spends the vault's own buffer and reserve. It cannot withdraw, transfer out, change rules or close the loan |
| Agent configured to aim at liquidation | `setRules` rejects `trigger <= 110%`, `target < trigger`, `target > 1000%` |
| Runaway agent | Owner kill switch `autoProtect`, plus per-vault 60 s cooldown in the agent |
| Reentrancy through BTC transfers | `nonReentrant` on value-moving functions |
| Chat or LLM manipulates the loan | The chat only proposes a rule patch, validated server-side. The owner signs it. The money path is the deterministic rules engine |
| UI shows a different truth than the chain | Shared `decide()` and direct on-chain read fallback |
| Wrong network or account | Network is re-checked before every transaction, disconnect resets state |
| Secrets in the repo | Keys live in `.env` (git-ignored). The only keys in the repo are public hardhat development keys for the local demo chain |

---

## 13. Known limitations

- **Testnet coverage:** the agent's `protect()` path is proven on Mezo testnet (below). The newer
  owner flows (withdraw, close loan, reopen loan, multi-vault) and the dashboard features around
  them were exercised on the demo network with mock Mezo contracts, **not** on live Mezo testnet,
  because of limited faucet funds. Real Mezo adds interest, fees, gas compensation and a higher
  minimum debt that the mocks simplify.
- **Mock liquidation:** the demo network does not liquidate. It proves the agent saves the loan;
  the "without the agent it would be liquidated" comparison comes from the simulator.
- **Single agent key:** one hot wallet signs for all vaults. No threshold or TEE signer yet.
- **JSON file storage:** events and history are stored in local files, fine for one agent
  instance, not for horizontal scaling.
- **No audit:** the contracts have unit tests but have not been independently audited.
- **Oracle:** the vault reads Mezo's `PriceFeed` and inherits its trust assumptions.

---

## Live proof on Mezo testnet

Deployed contracts:

| Contract | Address |
|---|---|
| `AgentVaultFactory` | `0x0Eb2cD465946e7eac309bCF311Dbd2Dd5cc7C31d` |
| Demo `AgentVault` | `0xAbb30839FE657D59b4CBCbB737f4af896c5a8b62` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| BorrowerOperations | `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` |
| TroveManager | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` |
| PriceFeed | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` |

Agent transactions (both are `protect()` calls sent by the agent hot wallet):

| # | Trigger | Action | ICR before to after | Tx |
|---|---|---|---|---|
| 1 | ICR 146.0% below the 150% trigger | top up 0.0082 BTC | 146.0% to 180.0% | `0x07f5b01d24ceb2687f43ffb92e4efe24017eeb8c3457807cb48ed5501dca0c72` |
| 2 | Owner borrowed 400 MUSD, ICR 150.0% | top up 0.0018 BTC and repay 315 MUSD | 150.0% to 179.9% | `0x06475c681bf031970e24c6f2e8103a3a184a148af5ca0790aa258610cef80984` |

Chain `31611`, RPC `https://rpc.test.mezo.org`, explorer https://explorer.test.mezo.org.

Output of `pnpm demo:stress` on testnet:

```
before borrowMore   ICR 180.07%  coll 0.04316 BTC  debt 2001.80 MUSD  buffer 0.00184 BTC  reserve 500.00 MUSD
Owner borrowed 400 MUSD (tx 0x7a0f5c93c4de97c3a0a5ebab40e61c32e1aa8f0173e03d916f120a8b48084d70)
after borrowMore    ICR 150.06%  coll 0.04316 BTC  debt 2402.20 MUSD  buffer 0.00184 BTC  reserve 500.00 MUSD
ICR is now 150.06% - below the 150% trigger. Waiting for the agent...

Agent acted:
after agent action  ICR 179.93%  coll 0.04500 BTC  debt 2087.14 MUSD  buffer 0.00000 BTC  reserve 184.94 MUSD
```

---

## 15. Buildathon fit

| Criterion (weight) | How AgentVault addresses it |
|---|---|
| Mezo Integration (30%) | The vault is a real Mezo borrower: opens, defends, adjusts and closes a trove through `BorrowerOperations`, reads `TroveManager` and `PriceFeed`, and uses a MUSD reserve to repay debt |
| Product and Business Viability (30%) | Extends Mezo Borrow with the one thing borrowers lack: automatic liquidation defence. Clear problem-solution fit and a Wave 2 plan to make the idle reserve productive |
| Technical Implementation (20%) | Isolated per-user contracts with on-chain bounds, deterministic shared rules engine, unit and end-to-end tests, state-based confirmation for an unreliable RPC, documented threat model |
| User Experience (10%) | Guided setup checklist, plain-language chat, risk insight, live chart, toasts and Telegram alerts, mobile-friendly |
| Submission Materials (10%) | This README, [SUBMISSION.md](SUBMISSION.md) with form answers, script and deck outline |

Track 1 (DeFi): borrowing automation on top of Mezo's trove. Track 2 (Access): Telegram bot,
plain-language chat and alerts.

---

## 16. Roadmap

- **Wave 2 yield loop:** route the idle MUSD reserve into a lending market or Mezo Earn and
  compound it, so the safety reserve grows instead of sitting idle.
- **Cross-vault rebalancing:** move safety funds to the most at-risk vault first.
- **Safer agent key:** threshold or TEE signer and an on-chain rules registry.
- **Mainnet:** independent security review, then a Mezo mainnet beta.

---

## 17. Repository layout

```
agentvault/
├── contracts/            Solidity + Hardhat
│   ├── contracts/        AgentVault, AgentVaultFactory, interfaces, mocks
│   ├── scripts/          deploy.ts (testnet), deploy-local.ts (demo network)
│   └── test/             AgentVault.test.ts
├── agent/                Agent service
│   ├── src/              server, monitor, rules, chain, chat, simulator, risk,
│   │                     history, store, watchlist, telegram, demo
│   └── scripts/          setup-demo, stress-demo, fund-agent, transfer, e2e-local
├── web/                  Next.js dashboard
│   ├── app/              layout, global styles
│   ├── components/       Landing, Dashboard, Header, CreateVault, Simulator,
│   │                     HistoryChart, RiskCard, MarketCard, Checklist,
│   │                     CloseLoanModal, NotificationsCard, Background3D, ui
│   └── lib/              api client, chain config, wallet hook, on-chain reads
├── shared/               ABIs, network and address config, shared rules engine
├── scripts/demo.mjs      One-command demo network runner
├── SUBMISSION.md         Buildathon submission pack
└── .env.example
```
