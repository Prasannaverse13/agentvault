import {
  createTestClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CORE, mockPriceFeedAbi } from "@agentvault/shared";
import { config } from "./config.js";
import { mezoTestnet, publicClient } from "./chain.js";

/** Everything in this module only exists on the local demo network. */
export const demoEnabled = config.local;

const admin = config.demoAdminKey ? privateKeyToAccount(config.demoAdminKey as Hex) : undefined;

const adminClient =
  demoEnabled && admin
    ? createWalletClient({ account: admin, chain: mezoTestnet, transport: http(config.rpcUrl) })
    : undefined;

const testClient = demoEnabled
  ? createTestClient({ chain: mezoTestnet, mode: "hardhat", transport: http(config.rpcUrl) })
  : undefined;

let startPrice: bigint | undefined;

export async function marketState() {
  const price = await publicClient.readContract({
    address: CORE.PRICE_FEED,
    abi: mockPriceFeedAbi,
    functionName: "fetchPrice",
  });
  startPrice ??= price;
  return {
    price: Number(price) / 1e18,
    startPrice: Number(startPrice) / 1e18,
  };
}

export async function setMarketPrice(usd: number): Promise<{ price: number; startPrice: number }> {
  if (!adminClient || !admin) throw new Error("Demo admin key is not configured");
  if (!Number.isFinite(usd) || usd < 1_000 || usd > 1_000_000) {
    throw new Error("Price must be between $1,000 and $1,000,000");
  }
  await marketState();
  const hash = await adminClient.writeContract({
    address: CORE.PRICE_FEED,
    abi: mockPriceFeedAbi,
    functionName: "setPrice",
    args: [parseEther(String(Math.round(usd)))],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return marketState();
}

export async function resetMarketPrice() {
  const { startPrice: base } = await marketState();
  return setMarketPrice(base);
}

/** Gives a wallet free demo BTC so it can pay for gas and collateral. */
export async function fundWallet(address: Address, btc = 100): Promise<{ balance: number }> {
  if (!testClient) throw new Error("The demo faucet is only available on the demo network");
  const current = await publicClient.getBalance({ address });
  const target = current + parseEther(String(btc));
  await testClient.setBalance({ address, value: target });
  return { balance: Number(target) / 1e18 };
}
