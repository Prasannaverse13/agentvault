import { createPublicClient, defineChain, http } from "viem";
import { MEZO_TESTNET } from "@agentvault/shared";

export const mezo = defineChain({
  id: MEZO_TESTNET.chainId,
  name: MEZO_TESTNET.name,
  nativeCurrency: MEZO_TESTNET.nativeCurrency,
  rpcUrls: { default: { http: [MEZO_TESTNET.rpc] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: MEZO_TESTNET.explorer } },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: mezo,
  transport: http(MEZO_TESTNET.rpc),
});

export const EXPLORER = MEZO_TESTNET.explorer;
export const FAUCET = MEZO_TESTNET.faucet;
export const CHAIN_ID_HEX = `0x${MEZO_TESTNET.chainId.toString(16)}`;
