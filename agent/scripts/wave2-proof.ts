/**
 * Wave 2 proof on Mezo testnet. Run after deploying the v2 factory:
 *
 *   pnpm contracts:deploy            # writes contracts/deployments/31611.json
 *   pnpm demo:wave2                  # this script
 *
 * It signs real Mezo testnet transactions:
 *   1. create a v2 vault from the v2 factory
 *   2. open a MUSD loan at about 200% ICR (above Mezo's 1800 MUSD minimum debt)
 *   3. fund a BTC buffer and a MUSD reserve
 *   4. put most of the reserve into the Mezo Stability Pool (earnDeposit)
 *   5. borrow more so the ICR drops below the trigger
 *   6. wait for the agent to protect() the loan, unwinding the pool to repay
 *      (if no agent is watching, it signs protect() itself with AGENT_PRIVATE_KEY)
 *
 * Every hash is printed and saved to contracts/deployments/wave2-proof.json.
 * Needs PRIVATE_KEY (owner) in ../.env. AGENT_PRIVATE_KEY is optional.
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  formatEther,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decide, erc20Abi, factoryAbi, vaultAbi, CORE } from "@agentvault/shared";

const RPC = process.env.MEZO_TESTNET_RPC || "https://rpc.test.mezo.org";
const EXPLORER = "https://explorer.test.mezo.org";

const CHAIN_ID = Number(process.env.CHAIN_ID ?? 31611); // 31337 = local dry run
const mezo = defineChain({
  id: CHAIN_ID,
  name: "Mezo Testnet",
  nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  testnet: true,
});

function loadEnv(): Record<string, string> {
  const file = path.resolve(process.cwd(), "../.env");
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const env = { ...loadEnv(), ...process.env } as Record<string, string | undefined>;
if (!env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in ../.env");
const owner = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
const agentKey = env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
const agentAccount = agentKey ? privateKeyToAccount(agentKey) : undefined;

const deploymentFile = path.resolve(process.cwd(), `../contracts/deployments/${CHAIN_ID}.json`);
const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
if (deployment.version !== "2.0.0") {
  throw new Error("contracts/deployments/31611.json is not a v2 deployment. Run pnpm contracts:deploy first.");
}
const FACTORY = deployment.factory as Address;
const AGENT = (env.AGENT_ADDRESS ?? agentAccount?.address ?? deployment.agent) as Address;
if (!AGENT) throw new Error("Set AGENT_ADDRESS or AGENT_PRIVATE_KEY so the vault has an agent.");

const DEBT = env.DEBT ?? "2300"; // > 1800 min net debt, leaves room for a capped repay
const START_ICR = Number(env.START_ICR ?? "2.0");
const BUFFER = env.BUFFER ?? "0.004";
const RESERVE = env.RESERVE ?? "600";
const EARN_SHARE = Number(env.EARN_SHARE ?? "0.7");
const TRIGGER_ICR = env.TRIGGER_ICR ?? "1.6";
const TARGET_ICR = env.TARGET_ICR ?? "1.9";

const pub = createPublicClient({ chain: mezo, transport: http(RPC) });
const ownerWallet = createWalletClient({ account: owner, chain: mezo, transport: http(RPC) });
const agentWallet = agentAccount
  ? createWalletClient({ account: agentAccount, chain: mezo, transport: http(RPC) })
  : undefined;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const proof: { step: string; tx: Hash; url: string; note?: string }[] = [];

/** The Mezo testnet RPC does not serve receipts reliably, so writes are confirmed by state. */
async function step<T>(label: string, send: () => Promise<Hash>, confirm: () => Promise<T | undefined>, note?: string) {
  const tx = await send();
  console.log(`→ ${label}\n  ${EXPLORER}/tx/${tx}`);
  for (let i = 0; i < 60; i += 1) {
    await sleep(3000);
    try {
      const v = await confirm();
      if (v !== undefined) {
        proof.push({ step: label, tx, url: `${EXPLORER}/tx/${tx}`, note });
        console.log("  confirmed");
        return v;
      }
    } catch {
      // not yet
    }
  }
  throw new Error(`Timed out confirming: ${label} (${tx})`);
}

async function main() {
  console.log(`Owner  ${owner.address}  ${formatEther(await pub.getBalance({ address: owner.address }))} BTC`);
  console.log(`Agent  ${AGENT}`);
  console.log(`Factory v2  ${FACTORY}\n`);

  const price = (await pub.readContract({
    address: CORE.PRICE_FEED as Address,
    abi: [{ type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
    functionName: "fetchPrice",
  })) as bigint;
  console.log(`BTC price ${Number(price) / 1e18}`);

  // 1. vault
  const before = (await pub.readContract({ address: FACTORY, abi: factoryAbi, functionName: "getVaults", args: [owner.address] })) as Address[];
  const vaults = await step(
    "create v2 vault",
    () =>
      ownerWallet.writeContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "createVault",
        args: [AGENT, parseEther(TRIGGER_ICR), parseEther(TARGET_ICR)],
      }),
    async () => {
      const now = (await pub.readContract({ address: FACTORY, abi: factoryAbi, functionName: "getVaults", args: [owner.address] })) as Address[];
      return now.length > before.length ? now : undefined;
    },
  );
  const vault = vaults[vaults.length - 1];
  console.log(`  vault ${EXPLORER}/address/${vault}`);

  const health = async () => {
    const h = (await pub.readContract({ address: vault, abi: vaultAbi, functionName: "health" })) as readonly bigint[];
    return { coll: h[0], debt: h[1], price: h[2], icr: h[3], status: Number(h[4]), buffer: h[5], reserve: h[6] };
  };
  const earn = async () => {
    const e = (await pub.readContract({ address: vault, abi: vaultAbi, functionName: "earnInfo" })) as readonly bigint[];
    return { pooled: e[0], gain: e[1], repayCap: e[6] };
  };

  // 2. loan at ~START_ICR (debt grows by Mezo's 200 MUSD gas compensation and fee)
  const totalDebt = parseEther(DEBT) + parseEther("230");
  const coll = (totalDebt * parseEther(String(START_ICR))) / price;
  await step(
    `open loan (${formatEther(coll)} BTC / ${DEBT} MUSD)`,
    () => ownerWallet.writeContract({ address: vault, abi: vaultAbi, functionName: "openLoan", args: [parseEther(DEBT)], value: coll }),
    async () => ((await health()).status === 1 ? true : undefined),
  );

  // 3. safety funds
  await step(
    `fund BTC buffer (${BUFFER} BTC)`,
    () => ownerWallet.sendTransaction({ to: vault, value: parseEther(BUFFER) }),
    async () => ((await health()).buffer > 0n ? true : undefined),
  );
  await step(
    "approve MUSD",
    () => ownerWallet.writeContract({ address: CORE.MUSD as Address, abi: erc20Abi, functionName: "approve", args: [vault, parseEther(RESERVE)] }),
    async () => {
      const a = (await pub.readContract({ address: CORE.MUSD as Address, abi: erc20Abi, functionName: "allowance", args: [owner.address, vault] })) as bigint;
      return a >= parseEther(RESERVE) ? true : undefined;
    },
  );
  await step(
    `fund MUSD reserve (${RESERVE})`,
    () => ownerWallet.writeContract({ address: vault, abi: vaultAbi, functionName: "fundReserve", args: [parseEther(RESERVE)] }),
    async () => ((await health()).reserve > 0n ? true : undefined),
  );

  // 4. Earn
  const toPool = (parseEther(RESERVE) * BigInt(Math.round(EARN_SHARE * 100))) / 100n;
  await step(
    `earnDeposit ${formatEther(toPool)} MUSD into the Mezo Stability Pool`,
    () => ownerWallet.writeContract({ address: vault, abi: vaultAbi, functionName: "earnDeposit", args: [toPool] }),
    async () => ((await earn()).pooled > 0n ? true : undefined),
    "Reserve now earns BTC from Mezo liquidations",
  );

  // 5. push ICR below the trigger by borrowing more
  const h = await health();
  const trigger = parseEther(TRIGGER_ICR);
  const targetDrop = (trigger * 95n) / 100n; // land 5% under the trigger
  const debtAtTarget = (h.coll * h.price) / targetDrop;
  const borrow = debtAtTarget > h.debt ? debtAtTarget - h.debt : parseEther("100");
  await step(
    `borrow ${formatEther(borrow).slice(0, 8)} MUSD more (ICR drops below ${Number(TRIGGER_ICR) * 100}%)`,
    () => ownerWallet.writeContract({ address: vault, abi: vaultAbi, functionName: "borrowMore", args: [borrow] }),
    async () => ((await health()).debt > h.debt ? true : undefined),
  );
  const stressed = await health();
  const pooledBefore = (await earn()).pooled;
  console.log(`  ICR now ${(Number(stressed.icr) / 1e16).toFixed(1)}%  pooled ${formatEther(pooledBefore)} MUSD`);

  // 6. agent rescue (the live agent should act within ~20 s once it watches this vault)
  console.log(`\nAdd this vault to the agent (AGENT_VAULTS=${vault}) or open it in the app. Waiting for protect()...`);
  let rescued = false;
  for (let i = 0; i < 40 && !rescued; i += 1) {
    await sleep(3000);
    const now = await health();
    rescued = now.icr > stressed.icr;
  }
  if (!rescued && agentWallet) {
    console.log("No agent acted yet. Signing protect() with AGENT_PRIVATE_KEY using the same rules engine.");
    const s = await health();
    const e = await earn();
    const d = decide(
      { coll: s.coll, debt: s.debt, price: s.price, buffer: s.buffer, reserve: s.reserve, pooled: e.pooled, maxRepay: e.repayCap },
      { triggerICR: trigger, targetICR: parseEther(TARGET_ICR), autoProtect: true },
    );
    console.log(`  decision: ${d.reason}`);
    await step(
      "agent protect() (unwinds Stability Pool MUSD to repay)",
      () => agentWallet.writeContract({ address: vault, abi: vaultAbi, functionName: "protect", args: [d.repayAmount, d.topUpAmount] }),
      async () => ((await health()).icr > s.icr ? true : undefined),
      d.reason,
    );
    rescued = true;
  } else if (rescued) {
    proof.push({ step: "agent protect() by the live agent", tx: "0x" as Hash, url: `${EXPLORER}/address/${vault}`, note: "See the AgentAction event on the vault page" });
  }

  const end = await health();
  const endEarn = await earn();
  console.log(`\nICR ${(Number(stressed.icr) / 1e16).toFixed(1)}% -> ${(Number(end.icr) / 1e16).toFixed(1)}%`);
  console.log(`Pooled MUSD ${formatEther(pooledBefore)} -> ${formatEther(endEarn.pooled)}`);

  const out = path.resolve(process.cwd(), `../contracts/deployments/wave2-proof${CHAIN_ID === 31611 ? "" : `-${CHAIN_ID}`}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        network: "Mezo Testnet",
        factory: FACTORY,
        vault,
        agent: AGENT,
        icrBefore: Number(stressed.icr) / 1e16,
        icrAfter: Number(end.icr) / 1e16,
        pooledBefore: formatEther(pooledBefore),
        pooledAfter: formatEther(endEarn.pooled),
        steps: proof,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`\nSaved ${out}\nVAULT_ADDRESS=${vault}\nDEMO_VAULT=${vault}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
