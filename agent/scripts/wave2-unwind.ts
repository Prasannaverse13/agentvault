/**
 * Second stress on the demo vault made by wave2-proof.ts.
 * The first rescue used the BTC buffer and the liquid MUSD. This one starts
 * with an empty buffer and almost no liquid MUSD, so protect() has to unwind
 * MUSD from the Mezo Stability Pool. Needs no extra BTC beyond gas.
 *
 *   pnpm --filter @agentvault/agent exec tsx scripts/wave2-unwind.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, parseEther, formatEther, type Address, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decide, vaultAbi } from "@agentvault/shared";

const RPC = process.env.MEZO_TESTNET_RPC || "https://rpc.test.mezo.org";
const EXPLORER = "https://explorer.test.mezo.org";
const mezo = defineChain({ id: 31611, name: "Mezo Testnet", nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 }, rpcUrls: { default: { http: [RPC] } }, testnet: true });

function loadEnv(): Record<string, string> {
  const file = path.resolve(process.cwd(), "../.env");
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}
const env = { ...loadEnv(), ...process.env } as Record<string, string | undefined>;
const owner = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
const agent = privateKeyToAccount(env.AGENT_PRIVATE_KEY as `0x${string}`);
const proofFile = path.resolve(process.cwd(), "../contracts/deployments/wave2-proof.json");
const prior = JSON.parse(fs.readFileSync(proofFile, "utf8"));
const vault = (env.VAULT_ADDRESS ?? prior.vault) as Address;
const TRIGGER = parseEther(env.TRIGGER_ICR ?? "1.25");
const TARGET = parseEther(env.TARGET_ICR ?? "1.40");

const pub = createPublicClient({ chain: mezo, transport: http(RPC) });
const ownerWallet = createWalletClient({ account: owner, chain: mezo, transport: http(RPC) });
const agentWallet = createWalletClient({ account: agent, chain: mezo, transport: http(RPC) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const steps: { step: string; tx: Hash; url: string; note?: string }[] = [];

const health = async () => {
  const h = (await pub.readContract({ address: vault, abi: vaultAbi, functionName: "health" })) as readonly bigint[];
  return { coll: h[0], debt: h[1], price: h[2], icr: h[3], buffer: h[5], reserve: h[6] };
};
const earn = async () => {
  const e = (await pub.readContract({ address: vault, abi: vaultAbi, functionName: "earnInfo" })) as readonly bigint[];
  return { pooled: e[0], repayCap: e[6] };
};
const pct = (v: bigint) => (Number(v) / 1e16).toFixed(1) + "%";

async function step(label: string, send: () => Promise<Hash>, done: () => Promise<boolean>, note?: string) {
  const tx = await send();
  console.log(`→ ${label}\n  ${EXPLORER}/tx/${tx}`);
  for (let i = 0; i < 60; i += 1) {
    await sleep(3000);
    try {
      if (await done()) {
        steps.push({ step: label, tx, url: `${EXPLORER}/tx/${tx}`, note });
        console.log("  confirmed");
        return;
      }
    } catch {
      // not yet
    }
  }
  throw new Error(`Timed out: ${label} (${tx})`);
}

async function main() {
  console.log(`Vault ${EXPLORER}/address/${vault}`);
  const h0 = await health();
  const e0 = await earn();
  console.log(`Now: ICR ${pct(h0.icr)}  buffer ${formatEther(h0.buffer)} BTC  liquid ${formatEther(h0.reserve)} MUSD  pooled ${formatEther(e0.pooled)} MUSD`);

  const targetDrop = (TRIGGER * 95n) / 100n;
  const debtAtTarget = (h0.coll * h0.price) / targetDrop;
  const auto = debtAtTarget > h0.debt ? debtAtTarget - h0.debt : parseEther("100");
  // Mezo caps borrowing at the loan's maxBorrowingCapacity, so BORROW can lower the amount.
  const borrow = env.BORROW ? parseEther(env.BORROW) : auto;
  await step(
    `borrow ${formatEther(borrow).slice(0, 8)} MUSD more (ICR below ${pct(TRIGGER)})`,
    () => ownerWallet.writeContract({ address: vault, abi: vaultAbi, functionName: "borrowMore", args: [borrow] }),
    async () => (await health()).debt > h0.debt,
  );

  const s = await health();
  const e = await earn();
  console.log(`Stressed: ICR ${pct(s.icr)}  buffer ${formatEther(s.buffer)} BTC  liquid ${formatEther(s.reserve)} MUSD  pooled ${formatEther(e.pooled)} MUSD`);
  const d = decide(
    { coll: s.coll, debt: s.debt, price: s.price, buffer: s.buffer, reserve: s.reserve, pooled: e.pooled, maxRepay: e.repayCap },
    { triggerICR: TRIGGER, targetICR: TARGET, autoProtect: true },
  );
  console.log(`decision: ${d.reason}`);
  await step(
    "agent protect() unwinds the Stability Pool",
    () => agentWallet.writeContract({ address: vault, abi: vaultAbi, functionName: "protect", args: [d.repayAmount, d.topUpAmount], gas: 10_000_000n }),
    async () => (await health()).debt < s.debt,
    d.reason,
  );

  const end = await health();
  const eEnd = await earn();
  console.log(`\nICR ${pct(s.icr)} -> ${pct(end.icr)}`);
  console.log(`Pooled MUSD ${formatEther(e.pooled)} -> ${formatEther(eEnd.pooled)}`);
  const out = path.resolve(process.cwd(), "../contracts/deployments/wave2-unwind-proof.json");
  fs.writeFileSync(out, JSON.stringify({ vault, icrBefore: pct(s.icr), icrAfter: pct(end.icr), pooledBefore: formatEther(e.pooled), pooledAfter: formatEther(eEnd.pooled), steps, at: new Date().toISOString() }, null, 2));
  console.log(`Saved ${out}`);
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
