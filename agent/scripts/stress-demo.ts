import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "@agentvault/shared";

const RPC = "https://rpc.test.mezo.org";
const VAULT = (process.env.VAULT_ADDRESS ??
  "0xAbb30839FE657D59b4CBCbB737f4af896c5a8b62") as Address;
const BORROW = process.env.BORROW ?? "400";

const mezo = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  testnet: true,
});

function loadEnv(): Record<string, string> {
  const file = path.resolve(process.cwd(), "../.env");
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const env = loadEnv();
const owner = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: mezo, transport: http(RPC) });
const wallet = createWalletClient({ account: owner, chain: mezo, transport: http(RPC) });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readState() {
  const health = (await publicClient.readContract({
    address: VAULT,
    abi: vaultAbi,
    functionName: "health",
  })) as readonly bigint[];
  return {
    coll: Number(health[0]) / 1e18,
    debt: Number(health[1]) / 1e18,
    price: Number(health[2]) / 1e18,
    icr: Number(health[3]) / 1e16,
    status: Number(health[4]),
    buffer: Number(health[5]) / 1e18,
    reserve: Number(health[6]) / 1e18,
  };
}

function show(label: string, s: Awaited<ReturnType<typeof readState>>) {
  console.log(
    `${label.padEnd(22)} ICR ${s.icr.toFixed(2)}%  coll ${s.coll.toFixed(5)} BTC  ` +
      `debt ${s.debt.toFixed(2)} MUSD  buffer ${s.buffer.toFixed(5)} BTC  reserve ${s.reserve.toFixed(2)} MUSD`,
  );
}

async function main() {
  const before = await readState();
  show("before borrowMore", before);

  const hash = await wallet.writeContract({
    address: VAULT,
    abi: vaultAbi,
    functionName: "borrowMore",
    args: [parseEther(BORROW)],
  });
  console.log(`\nOwner borrowed ${BORROW} MUSD (tx ${hash})`);

  let afterBorrow = before;
  for (let i = 0; i < 30; i += 1) {
    await sleep(2000);
    afterBorrow = await readState();
    if (afterBorrow.debt > before.debt) break;
  }
  show("after borrowMore", afterBorrow);
  console.log(
    `ICR is now ${afterBorrow.icr.toFixed(2)}% — below the 150% trigger. Waiting for the agent…\n`,
  );

  let last = afterBorrow;
  for (let i = 0; i < 60; i += 1) {
    await sleep(3000);
    const now = await readState();
    if (now.coll > last.coll || now.debt < last.debt) {
      console.log("Agent acted:");
      show("after agent action", now);
      break;
    }
    last = now;
  }

  const final = await readState();
  show("final", final);
  console.log(
    `\nTrigger 150% ICR · Target 180% ICR · final ICR ${final.icr.toFixed(2)}%`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
