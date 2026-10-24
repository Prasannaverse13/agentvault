/**
 * Network configuration.
 *
 * Default: Mezo testnet with the real Mezo protocol contracts.
 * NETWORK=local (NEXT_PUBLIC_NETWORK=local for the web app): a local demo
 * chain with mock Mezo contracts at deterministic addresses. Every flow is a
 * real on-chain transaction, but funds are free, so the whole product can be
 * demoed end to end without a faucet.
 */
const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? process.env.NETWORK ?? "testnet";

export const IS_LOCAL = NETWORK === "local";

const TESTNET = {
  chainId: 31611,
  name: "Mezo Testnet",
  rpc: "https://rpc.test.mezo.org",
  explorer: "https://explorer.test.mezo.org",
  faucet: "https://faucet.test.mezo.org",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
};

const LOCAL = {
  chainId: 31337,
  name: "AgentVault Demo Network",
  rpc: "http://127.0.0.1:8545",
  explorer: "",
  faucet: "",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
};

export const MEZO_TESTNET: typeof TESTNET = IS_LOCAL ? LOCAL : TESTNET;

const TESTNET_CORE = {
  MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  BORROWER_OPERATIONS: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  TROVE_MANAGER: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  SORTED_TROVES: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  HINT_HELPERS: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  PRICE_FEED: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
} as const;

// Deployed by hardhat account #0 on a fresh node, in this exact order, so the
// addresses are deterministic (verified by contracts/scripts/deploy-local.ts).
export const LOCAL_CORE = {
  MUSD: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  BORROWER_OPERATIONS: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  TROVE_MANAGER: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  SORTED_TROVES: "0x0000000000000000000000000000000000000000",
  HINT_HELPERS: "0x0000000000000000000000000000000000000000",
  PRICE_FEED: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
} as const;

export const LOCAL_FACTORY = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as const;

export const CORE: typeof TESTNET_CORE = (IS_LOCAL
  ? LOCAL_CORE
  : TESTNET_CORE) as unknown as typeof TESTNET_CORE;

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  process.env.FACTORY_ADDRESS ??
  (IS_LOCAL ? LOCAL_FACTORY : "")) as `0x${string}`;

export const AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8787").replace(
  /\/$/,
  "",
);
