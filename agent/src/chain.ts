import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  vaultAbi,
  factoryAbi,
  priceFeedAbi,
  MEZO_TESTNET,
  CORE,
} from "@agentvault/shared";
import { config } from "./config.js";

export const mezoTestnet = defineChain({
  id: MEZO_TESTNET.chainId,
  name: MEZO_TESTNET.name,
  nativeCurrency: MEZO_TESTNET.nativeCurrency,
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: MEZO_TESTNET.explorer },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(config.rpcUrl),
});

export const agentAccount = config.privateKey
  ? privateKeyToAccount(config.privateKey as Hex)
  : undefined;

export const walletClient = agentAccount
  ? createWalletClient({
      account: agentAccount,
      chain: mezoTestnet,
      transport: http(config.rpcUrl),
    })
  : undefined;

export type VaultSnapshot = {
  address: Address;
  owner: Address;
  agent: Address;
  autoProtect: boolean;
  triggerICR: bigint;
  targetICR: bigint;
  coll: bigint;
  debt: bigint;
  price: bigint;
  icr: bigint;
  status: number;
  btcBuffer: bigint;
  musdReserve: bigint;
  liquidationPrice: bigint;
  fetchedAt: number;
};

export async function readPrice(): Promise<bigint> {
  return publicClient.readContract({
    address: CORE.PRICE_FEED,
    abi: priceFeedAbi,
    functionName: "fetchPrice",
  });
}

export async function readVault(address: Address): Promise<VaultSnapshot> {
  const [health, owner, agent, autoProtect, triggerICR, targetICR, liquidationPrice] =
    await Promise.all([
      publicClient.readContract({
        address,
        abi: vaultAbi,
        functionName: "health",
      }),
      publicClient.readContract({ address, abi: vaultAbi, functionName: "owner" }),
      publicClient.readContract({ address, abi: vaultAbi, functionName: "agent" }),
      publicClient.readContract({ address, abi: vaultAbi, functionName: "autoProtect" }),
      publicClient.readContract({ address, abi: vaultAbi, functionName: "triggerICR" }),
      publicClient.readContract({ address, abi: vaultAbi, functionName: "targetICR" }),
      publicClient
        .readContract({ address, abi: vaultAbi, functionName: "liquidationPrice" })
        .catch(() => 0n),
    ]);

  const [coll, debt, price, icr, status, btcBuffer, musdReserve] = health;

  return {
    address,
    owner,
    agent,
    autoProtect,
    triggerICR,
    targetICR,
    coll,
    debt,
    price,
    icr,
    status: Number(status),
    btcBuffer,
    musdReserve,
    liquidationPrice,
    fetchedAt: Date.now(),
  };
}

export async function getVaultsOf(owner: Address): Promise<Address[]> {
  if (!config.factoryAddress) return [];
  const vaults = await publicClient.readContract({
    address: config.factoryAddress,
    abi: factoryAbi,
    functionName: "getVaults",
    args: [owner],
  });
  return [...vaults];
}

export async function protectVault(
  vault: Address,
  repayAmount: bigint,
  topUpAmount: bigint,
): Promise<Hex> {
  if (!walletClient || !agentAccount) {
    throw new Error("Agent wallet is not configured");
  }

  const { request } = await publicClient.simulateContract({
    account: agentAccount,
    address: vault,
    abi: vaultAbi,
    functionName: "protect",
    args: [repayAmount, topUpAmount],
  });

  const before = await readVault(vault);
  const hash = await walletClient.writeContract(request);
  await waitForTx(hash, async () => {
    const now = await readVault(vault);
    return now.coll > before.coll || now.debt < before.debt;
  });
  return hash;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Mezo testnet RPC does not answer eth_getTransactionReceipt reliably,
 * so a transaction is confirmed by observing the expected state change.
 * The receipt is only used as a fallback.
 */
export async function waitForTx(
  hash: Hex,
  confirm?: () => Promise<boolean>,
): Promise<boolean> {
  if (confirm) {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await sleep(2000);
      try {
        if (await confirm()) return true;
      } catch {
        // state not ready yet
      }
    }
  }

  const receipt = await publicClient
    .waitForTransactionReceipt({ hash, timeout: 20_000 })
    .catch(() => null);

  if (receipt) return receipt.status === "success";
  if (confirm) throw new Error(`Transaction ${hash} did not change state in time`);
  return true;
}

export function btc(value: bigint): string {
  return `${formatUnits(value, 18)} BTC`;
}

export function musd(value: bigint): string {
  return `${formatUnits(value, 18)} MUSD`;
}

export function pct(icr: bigint): string {
  return `${(Number(icr) / 1e16).toFixed(1)}%`;
}
