import { createPublicClient, defineChain, http, formatEther } from "viem";
// Read only. Prints the vault health three times.
const rpc = process.env.MEZO_TESTNET_RPC || "https://rpc.test.mezo.org";
const chain = defineChain({ id: 31611, name: "Mezo Testnet", nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
const pub = createPublicClient({ chain, transport: http(rpc) });
const vault = process.env.VAULT_ADDRESS;
const abi = [{ type: "function", name: "health", stateMutability: "view", inputs: [], outputs: ["coll","debt","price","icr","status","btcBuffer","musdReserve"].map((name, i) => ({ name, type: i === 4 ? "uint8" : "uint256" })) }];
for (let i = 0; i < 3; i += 1) {
  const h = await pub.readContract({ address: vault, abi, functionName: "health" });
  console.log(`block ${await pub.getBlockNumber()} coll ${formatEther(h[0])} debt ${formatEther(h[1])} price ${formatEther(h[2])} icr ${Number(h[3]) / 1e16}% status ${h[4]} buffer ${formatEther(h[5])} reserve ${formatEther(h[6])}`);
  await new Promise((r) => setTimeout(r, 3000));
}
