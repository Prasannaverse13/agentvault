export const MEZO_TESTNET = {
  chainId: 31611,
  name: "Mezo Testnet",
  rpc: "https://rpc.test.mezo.org",
  explorer: "https://explorer.test.mezo.org",
  faucet: "https://faucet.test.mezo.org",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
} as const;

export const CORE = {
  MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  BORROWER_OPERATIONS: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  TROVE_MANAGER: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  SORTED_TROVES: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  HINT_HELPERS: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  PRICE_FEED: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
} as const;

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  process.env.FACTORY_ADDRESS ??
  "") as `0x${string}`;

export const AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8787").replace(
  /\/$/,
  "",
);
