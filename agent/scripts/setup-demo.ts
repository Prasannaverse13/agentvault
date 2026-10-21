import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { factoryAbi, vaultAbi, erc20Abi, CORE } from "@agentvault/shared";

const RPC = "https://rpc.test.mezo.org";
const FACTORY = (process.env.FACTORY_ADDRESS ??
  "0x0Eb2cD465946e7eac309bCF311Dbd2Dd5cc7C31d") as Address;
const AGENT = "0xe01b65A9705A306f70080964617A3EBE2f63FC12" as Address;

const mezo = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
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

const COLLATERAL = process.env.COLLATERAL ?? "0.035";
const DEBT = process.env.DEBT ?? "1800";
const BUFFER = process.env.BUFFER ?? "0.01";
const RESERVE = process.env.RESERVE ?? "500";
const TRIGGER_ICR = process.env.TRIGGER_ICR ?? "1.5";
const TARGET_ICR = process.env.TARGET_ICR ?? "1.8";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Mezo testnet RPC does not serve eth_getTransactionReceipt reliably,
 * so every write is confirmed by polling the contract state instead.
 */
async function sendAndConfirm<T>(
  label: string,
  request: () => Promise<Hash>,
  confirm: () => Promise<T | undefined>,
): Promise<T | undefined> {
  const hash = await request();
  console.log(`→ ${label}\n  tx ${hash}`);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(3000);
    try {
      const value = await confirm();
      if (value !== undefined) {
        console.log("  confirmed");
        return value;
      }
    } catch {
      // state not ready yet
    }
  }
  throw new Error(`Timed out confirming: ${label}`);
}

async function main() {
  console.log(`Owner: ${owner.address}`);
  console.log(
    `Balance: ${Number(await publicClient.getBalance({ address: owner.address })) / 1e18} BTC`,
  );

  const price = await publicClient.readContract({
    address: CORE.PRICE_FEED as Address,
    abi: [{ type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
    functionName: "fetchPrice",
  });
  console.log(`BTC price: ${Number(price) / 1e18}`);

  const existing = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "getVaults",
    args: [owner.address],
  });

  let vault: Address;
  if (existing.length > 0) {
    vault = existing[existing.length - 1] as Address;
    console.log(`Reusing vault: ${vault}`);
  } else {
    const before = await publicClient.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "vaultCount",
    });
    await sendAndConfirm(
      "create vault",
      () =>
        wallet.writeContract({
          address: FACTORY,
          abi: factoryAbi,
          functionName: "createVault",
          args: [AGENT, parseEther(TRIGGER_ICR), parseEther(TARGET_ICR)],
        }),
      async () => {
        const now = await publicClient.readContract({
          address: FACTORY,
          abi: factoryAbi,
          functionName: "vaultCount",
        });
        return now > before ? now : undefined;
      },
    );
    const vaults = await publicClient.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "getVaults",
      args: [owner.address],
    });
    vault = vaults[vaults.length - 1] as Address;
  }
  console.log(`Vault: ${vault}`);

  const readHealth = async () => {
    const health = (await publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "health",
    })) as readonly bigint[];
    return {
      coll: health[0],
      debt: health[1],
      price: health[2],
      icr: health[3],
      status: Number(health[4]),
      buffer: health[5],
      reserve: health[6],
    };
  };

  const before = await readHealth();
  if (before.status !== 1) {
    await sendAndConfirm(
      `open loan (${COLLATERAL} BTC / ${DEBT} MUSD)`,
      () =>
        wallet.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "openLoan",
          args: [parseEther(DEBT)],
          value: parseEther(COLLATERAL),
        }),
      async () => {
        const now = await readHealth();
        return now.status === 1 ? now : undefined;
      },
    );
  } else {
    console.log("→ loan already open");
  }

  const afterLoan = await readHealth();
  if (afterLoan.buffer === 0n) {
    await sendAndConfirm(
      `fund BTC buffer (${BUFFER} BTC)`,
      () => wallet.sendTransaction({ to: vault, value: parseEther(BUFFER) }),
      async () => {
        const now = await readHealth();
        return now.buffer > 0n ? now : undefined;
      },
    );
  } else {
    console.log(`→ buffer already funded: ${Number(afterLoan.buffer) / 1e18} BTC`);
  }

  if (afterLoan.reserve === 0n) {
    await sendAndConfirm(
      "approve MUSD",
      () =>
        wallet.writeContract({
          address: CORE.MUSD as Address,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, parseEther(RESERVE)],
        }),
      async () => {
        const allowance = (await publicClient.readContract({
          address: CORE.MUSD as Address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner.address, vault],
        })) as bigint;
        return allowance > 0n ? allowance : undefined;
      },
    );

    await sendAndConfirm(
      `fund MUSD reserve (${RESERVE})`,
      () =>
        wallet.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "fundReserve",
          args: [parseEther(RESERVE)],
        }),
      async () => {
        const now = await readHealth();
        return now.reserve > 0n ? now : undefined;
      },
    );
  } else {
    console.log(`→ reserve already funded: ${Number(afterLoan.reserve) / 1e18} MUSD`);
  }

  const final = await readHealth();
  const musdBalance = (await publicClient.readContract({
    address: CORE.MUSD as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner.address],
  })) as bigint;

  console.log("\n--- vault state ---");
  console.log(`coll      ${Number(final.coll) / 1e18} BTC`);
  console.log(`debt      ${Number(final.debt) / 1e18} MUSD`);
  console.log(`price     ${Number(final.price) / 1e18}`);
  console.log(`ICR       ${(Number(final.icr) / 1e16).toFixed(2)}%`);
  console.log(`status    ${final.status}`);
  console.log(`buffer    ${Number(final.buffer) / 1e18} BTC`);
  console.log(`reserve   ${Number(final.reserve) / 1e18} MUSD`);
  console.log(`owner MUSD ${Number(musdBalance) / 1e18}`);
  console.log(`owner BTC  ${Number(await publicClient.getBalance({ address: owner.address })) / 1e18}`);
  console.log(`\nVAULT_ADDRESS=${vault}`);
  console.log(`FACTORY_ADDRESS=${FACTORY}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
