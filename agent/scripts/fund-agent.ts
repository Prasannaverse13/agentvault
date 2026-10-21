import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, parseEther, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://rpc.test.mezo.org";
const AGENT = "0xe01b65A9705A306f70080964617A3EBE2f63FC12" as Address;
const AMOUNT = process.env.AMOUNT ?? "0.001";

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

async function main() {
  const before = await publicClient.getBalance({ address: AGENT });
  console.log(`Agent balance before: ${Number(before) / 1e18} BTC`);

  const hash = await wallet.sendTransaction({ to: AGENT, value: parseEther(AMOUNT) });
  console.log(`Sent ${AMOUNT} BTC for gas: ${hash}`);

  for (let i = 0; i < 30; i += 1) {
    await sleep(2000);
    const now = await publicClient.getBalance({ address: AGENT });
    if (now > before) {
      console.log(`Agent balance after: ${Number(now) / 1e18} BTC`);
      return;
    }
  }
  throw new Error("Transfer was not observed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
