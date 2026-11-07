import { createPublicClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Read only. Estimates gas for protect() at several repay sizes on the demo vault.
const rpc = process.env.MEZO_TESTNET_RPC || "https://rpc.test.mezo.org";
const chain = defineChain({ id: 31611, name: "Mezo Testnet", nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
const pub = createPublicClient({ chain, transport: http(rpc) });
const agent = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const vault = process.env.VAULT_ADDRESS;
const abi = [{ type: "function", name: "protect", stateMutability: "nonpayable", inputs: [{ name: "repayAmount", type: "uint256" }, { name: "topUpAmount", type: "uint256" }], outputs: [] }];
for (const repay of ["5", "10", "17", "50", "100", "200", "300"]) {
  try {
    const gas = await pub.estimateContractGas({ address: vault, abi, functionName: "protect", args: [parseEther(repay), 0n], account: agent.address });
    console.log("protect repay", repay, "MUSD gas", String(gas));
  } catch (e) {
    console.log("protect repay", repay, "MUSD fails:", (e.details || e.shortMessage || String(e)).slice(0, 160));
  }
}
