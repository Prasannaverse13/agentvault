/**
 * End-to-end check against the local demo network (`pnpm demo` must be running).
 * Signs real transactions as a fresh wallet and asserts that the agent
 * defends the loan when the BTC price crashes.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LOCAL_CORE as CORE, LOCAL_FACTORY, erc20Abi, factoryAbi, vaultAbi } from "@agentvault/shared";

const RPC = "http://127.0.0.1:8545";
const AGENT_API = "http://localhost:8787";
// Any fresh key works: the demo faucet funds it.
const OWNER_KEY = "0x1111111111111111111111111111111111111111111111111111111111111111";

const chain = defineChain({
  id: 31337,
  name: "demo",
  nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const owner = privateKeyToAccount(OWNER_KEY);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account: owner, chain, transport: http(RPC) });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${AGENT_API}${path}`, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${path}: ${json.error ?? res.status}`);
  return json;
}

async function send(hash: `0x${string}`) {
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`tx ${hash} reverted`);
}

async function main() {
  const health = await api<{ demo: boolean; agent: string }>("/api/health");
  check("agent reports demo network", health.demo === true);

  await api("/api/demo/price", { method: "POST", body: JSON.stringify({ reset: true }) });

  // 0. the in-app faucet must give a brand new wallet free funds
  const funded = await api<{ balance: number }>("/api/demo/faucet", {
    method: "POST",
    body: JSON.stringify({ address: owner.address, amount: 200 }),
  });
  check("demo faucet funded the wallet", funded.balance >= 200, `${funded.balance} BTC`);

  // 1. vault
  const trigger = parseEther("1.6667");
  const target = parseEther("2");
  await send(
    await wallet.writeContract({
      address: LOCAL_FACTORY,
      abi: factoryAbi,
      functionName: "createVault",
      args: [health.agent as Address, trigger, target],
    }),
  );
  const vaults = await pub.readContract({
    address: LOCAL_FACTORY,
    abi: factoryAbi,
    functionName: "getVaults",
    args: [owner.address],
  });
  const vault = vaults[vaults.length - 1] as Address;
  check("vault created through the factory", Boolean(vault), vault);

  // 2. loan + safety funds
  await send(
    await wallet.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "openLoan",
      args: [parseEther("40000")],
      value: parseEther("1"),
    }),
  );
  await send(await wallet.sendTransaction({ to: vault, value: parseEther("0.25") }));
  await send(
    await wallet.writeContract({
      address: CORE.MUSD,
      abi: erc20Abi,
      functionName: "approve",
      args: [vault, parseEther("5000")],
    }),
  );
  await send(
    await wallet.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "fundReserve",
      args: [parseEther("5000")],
    }),
  );

  await api("/api/watch", { method: "POST", body: JSON.stringify({ vault }) });

  type Status = {
    position: { icr: number; coll: number; debt: number; btcBuffer: number; musdReserve: number; price: number };
    events: { type: string; txHash?: string }[];
  };
  const before = await api<Status>(`/api/status/${vault}`);
  check("loan is healthy at the start", before.position.icr > 190, `ICR ${before.position.icr.toFixed(1)}%`);
  check("safety funds are in the vault", before.position.btcBuffer > 0.2 && before.position.musdReserve > 4000);

  const riskBefore = await api<{ survivableDropWithAgent: number; dropToLiquidation: number; band: string }>(
    `/api/risk/${vault}`,
  );
  check(
    "risk report: the agent extends survivable drop",
    riskBefore.survivableDropWithAgent > riskBefore.dropToLiquidation,
    `${riskBefore.survivableDropWithAgent}% vs ${riskBefore.dropToLiquidation.toFixed(1)}% unprotected`,
  );

  // 3. crash the market; the agent must act on its own
  const market = await api<{ price: number }>("/api/demo/price", {
    method: "POST",
    body: JSON.stringify({ changePct: -25 }),
  });
  check("oracle moved", Math.round(market.price) === 60000, `$${market.price}`);

  let after = before;
  for (let i = 0; i < 25; i += 1) {
    await sleep(1500);
    after = await api<Status>(`/api/status/${vault}`);
    if (after.events.some((e) => e.type === "execution")) break;
  }
  const execution = after.events.find((e) => e.type === "execution");
  check("agent executed protect() on-chain", Boolean(execution?.txHash), execution?.txHash?.slice(0, 12));
  check(
    "collateral or debt improved",
    after.position.coll > before.position.coll || after.position.debt < before.position.debt,
    `coll ${before.position.coll}->${after.position.coll}, debt ${before.position.debt}->${after.position.debt}`,
  );
  check("ICR restored above the trigger", after.position.icr > 166, `ICR ${after.position.icr.toFixed(1)}%`);

  const hist = await api<{ points: unknown[] }>(`/api/history/${vault}`);
  check("health history is being recorded", hist.points.length > 0, `${hist.points.length} points`);

  // 4. owner lifecycle: rules, withdraw buffer, close loan
  await send(
    await wallet.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "setRules",
      args: [parseEther("1.7"), parseEther("2.2"), true],
    }),
  );
  const rules = await api<Status & { position: { triggerICR: number } }>(`/api/status/${vault}`);
  check("rules update is visible", Math.abs(rules.position.triggerICR - 170) < 0.5);

  await api("/api/demo/price", { method: "POST", body: JSON.stringify({ reset: true }) });

  if (process.env.E2E_KEEP) {
    // Leave this vault open so it can be explored or chatted with.
    console.log(`
Kept vault ${vault} open (E2E_KEEP). ${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
    process.exitCode = failures === 0 ? 0 : 1;
    return;
  }

  const bufferNow = await pub.getBalance({ address: vault });
  if (bufferNow > 0n) {
    await send(
      await wallet.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "sweepBTC",
        args: [owner.address, bufferNow],
      }),
    );
  }
  check("BTC buffer withdrawn", (await pub.getBalance({ address: vault })) === 0n);

  const debt = (await pub.readContract({ address: vault, abi: vaultAbi, functionName: "health" }))[1];
  const reserve = await pub.readContract({
    address: CORE.MUSD,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [vault],
  });
  const missing = debt > reserve ? debt - reserve : 0n;
  if (missing > 0n) {
    await send(
      await wallet.writeContract({
        address: CORE.MUSD,
        abi: erc20Abi,
        functionName: "approve",
        args: [vault, missing],
      }),
    );
    await send(
      await wallet.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "fundReserve",
        args: [missing],
      }),
    );
  }
  await send(await wallet.writeContract({ address: vault, abi: vaultAbi, functionName: "closeLoan" }));
  const closed = await pub.readContract({ address: vault, abi: vaultAbi, functionName: "health" });
  check("loan closed and trove status is 2", Number(closed[4]) === 2);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
