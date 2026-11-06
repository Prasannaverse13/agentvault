export const CORE = {
  MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  BORROWER_OPERATIONS: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  TROVE_MANAGER: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  PRICE_FEED: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  // Mezo testnet (matsnet) Stability Pool, from mezo-org/musd deployments.
  STABILITY_POOL: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
} as const;

/** Default fee terms. Hard caps live in AgentVault: 1% protect, 20% performance. */
export const FEES = {
  PROTECT_FEE_BPS: Number(process.env.PROTECT_FEE_BPS ?? 50), // 0.5%
  PERFORMANCE_FEE_BPS: Number(process.env.PERFORMANCE_FEE_BPS ?? 1000), // 10%
} as const;
