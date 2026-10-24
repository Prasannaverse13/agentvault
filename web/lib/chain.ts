import { createPublicClient, defineChain, http } from "viem";
import { IS_LOCAL, MEZO_TESTNET } from "@agentvault/shared";

export const mezo = defineChain({
  id: MEZO_TESTNET.chainId,
  name: MEZO_TESTNET.name,
  nativeCurrency: MEZO_TESTNET.nativeCurrency,
  rpcUrls: { default: { http: [MEZO_TESTNET.rpc] } },
  ...(MEZO_TESTNET.explorer
    ? { blockExplorers: { default: { name: "Mezo Explorer", url: MEZO_TESTNET.explorer } } }
    : {}),
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: mezo,
  transport: http(MEZO_TESTNET.rpc),
  // The demo chain mines instantly, so poll for receipts quickly.
  pollingInterval: IS_LOCAL ? 700 : 4000,
});

export const EXPLORER = MEZO_TESTNET.explorer;
export const FAUCET = MEZO_TESTNET.faucet;
export const IS_DEMO = IS_LOCAL;

/** Explorer links exist on testnet only; the local demo chain has none. */
export const txUrl = (hash: string): string | undefined =>
  EXPLORER ? `${EXPLORER}/tx/${hash}` : undefined;
export const addressUrl = (address: string): string | undefined =>
  EXPLORER ? `${EXPLORER}/address/${address}` : undefined;
export const CHAIN_ID_HEX = `0x${MEZO_TESTNET.chainId.toString(16)}`;
