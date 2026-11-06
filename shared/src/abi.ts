export const vaultAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "agent", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "autoProtect", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "triggerICR", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "targetICR", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "health",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "coll", type: "uint256" },
      { name: "debt", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "icr", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "btcBuffer", type: "uint256" },
      { name: "musdReserve", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "liquidationPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "setRules",
    stateMutability: "nonpayable",
    inputs: [
      { name: "triggerICR_", type: "uint256" },
      { name: "targetICR_", type: "uint256" },
      { name: "autoProtect_", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAgent",
    stateMutability: "nonpayable",
    inputs: [{ name: "agent_", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "openLoan",
    stateMutability: "payable",
    inputs: [{ name: "debtAmount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fundReserve",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "borrowMore",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  { type: "function", name: "addCollateral", stateMutability: "payable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "withdrawCollateral",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  { type: "function", name: "closeLoan", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "protect",
    stateMutability: "nonpayable",
    inputs: [
      { name: "repayAmount", type: "uint256" },
      { name: "topUpAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sweepMUSD",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sweepBTC",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  // ---- v2 (Wave 2) ----
  { type: "function", name: "VERSION", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "earnInfo",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "pooledMusd", type: "uint256" },
      { name: "pendingBtcGain", type: "uint256" },
      { name: "earnedBtc", type: "uint256" },
      { name: "feesBtc", type: "uint256" },
      { name: "feesMusd", type: "uint256" },
      { name: "surplusClaimed", type: "uint256" },
      { name: "repayCap", type: "uint256" },
      { name: "protectFee", type: "uint256" },
      { name: "performanceFee", type: "uint256" },
    ],
  },
  { type: "function", name: "maxRepay", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "stabilityPool", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "feeRecipient", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "earnDeposit", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "earnWithdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "harvest", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimSurplus", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "event", name: "EarnDeposited", inputs: [{ name: "by", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
  { type: "event", name: "EarnWithdrawn", inputs: [{ name: "by", type: "address", indexed: true }, { name: "musdOut", type: "uint256" }, { name: "btcGain", type: "uint256" }] },
  { type: "event", name: "EarnUnwindFailed", inputs: [{ name: "requested", type: "uint256" }] },
  { type: "event", name: "Harvested", inputs: [{ name: "by", type: "address", indexed: true }, { name: "btcGain", type: "uint256" }, { name: "toTrove", type: "uint256" }, { name: "fee", type: "uint256" }] },
  { type: "event", name: "SurplusClaimed", inputs: [{ name: "by", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
  { type: "event", name: "FeePaid", inputs: [{ name: "to", type: "address", indexed: true }, { name: "btcAmount", type: "uint256" }, { name: "musdAmount", type: "uint256" }] },
  { type: "event", name: "LoanOpened", inputs: [{ name: "owner", type: "address", indexed: true }, { name: "coll", type: "uint256" }, { name: "debt", type: "uint256" }] },
  { type: "event", name: "RulesUpdated", inputs: [{ name: "triggerICR", type: "uint256" }, { name: "targetICR", type: "uint256" }, { name: "autoProtect", type: "bool" }] },
  { type: "event", name: "AgentAction", inputs: [{ name: "kind", type: "uint8", indexed: true }, { name: "repayAmount", type: "uint256" }, { name: "topUpAmount", type: "uint256" }, { name: "price", type: "uint256" }, { name: "icrBefore", type: "uint256" }, { name: "icrAfter", type: "uint256" }] },
  { type: "event", name: "CollateralAdded", inputs: [{ name: "from", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
  { type: "event", name: "DebtRepaid", inputs: [{ name: "from", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
  { type: "event", name: "CollateralWithdrawn", inputs: [{ name: "to", type: "address", indexed: true }, { name: "amount", type: "uint256" }] },
] as const;

export const factoryAbi = [
  {
    type: "function",
    name: "createVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "triggerICR", type: "uint256" },
      { name: "targetICR", type: "uint256" },
    ],
    outputs: [{ name: "vault", type: "address" }],
  },
  {
    type: "function",
    name: "getVaults",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  { type: "function", name: "vaultCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "stabilityPool", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "protectFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "performanceFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "event", name: "VaultCreated", inputs: [{ name: "owner", type: "address", indexed: true }, { name: "vault", type: "address", indexed: true }, { name: "agent", type: "address", indexed: true }] },
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export const priceFeedAbi = [
  { type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const troveManagerAbi = [
  { type: "function", name: "getTroveColl", stateMutability: "view", inputs: [{ name: "_borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveDebt", stateMutability: "view", inputs: [{ name: "_borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getCurrentICR", stateMutability: "view", inputs: [{ name: "_borrower", type: "address" }, { name: "_price", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveStatus", stateMutability: "view", inputs: [{ name: "_borrower", type: "address" }], outputs: [{ type: "uint8" }] },
] as const;

export const borrowerOpsAbi = [
  { type: "function", name: "minNetDebt", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getBorrowingFee", stateMutability: "view", inputs: [{ name: "_debt", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

/** Only the demo network's mock oracle exposes setPrice. */
export const mockPriceFeedAbi = [
  { type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "setPrice", stateMutability: "nonpayable", inputs: [{ name: "price_", type: "uint256" }], outputs: [] },
] as const;

export const stabilityPoolAbi = [
  { type: "function", name: "getTotalMUSDDeposits", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getCollateralBalance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getCompoundedMUSDDeposit", stateMutability: "view", inputs: [{ name: "_depositor", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getDepositorCollateralGain", stateMutability: "view", inputs: [{ name: "_depositor", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
