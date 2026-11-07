import { createPublicClient, defineChain, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Read only. Asks the node how much gas a Stability Pool withdraw through the demo vault needs.
const rpc = process.env.MEZO_TESTNET_RPC || "https://rpc.test.mezo.org";
const chain = defineChain({ id: 31611, name: "Mezo Testnet", nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
const pub = createPublicClient({ chain, transport: http(rpc) });
const owner = privateKeyToAccount(process.env.PRIVATE_KEY);
const vault = process.env.VAULT_ADDRESS;
const abi = [
  { type: "function", name: "earnWithdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "earnInfo", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
];
console.log("earnInfo", (await pub.readContract({ address: vault, abi, functionName: "earnInfo" })).map(String));
for (const amount of ["1", "100", "300"]) {
  try {
    const gas = await pub.estimateContractGas({ address: vault, abi, functionName: "earnWithdraw", args: [parseEther(amount)], account: owner.address });
    console.log("withdraw", amount, "MUSD gas", String(gas));
  } catch (e) {
    console.log("withdraw", amount, "MUSD fails:", (e.details || e.shortMessage || String(e)).slice(0, 200));
  }
}
