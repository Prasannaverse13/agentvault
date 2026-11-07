import { createPublicClient, createWalletClient, defineChain, http, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpc = process.env.MEZO_RPC_URL || "https://rpc.test.mezo.org";
const chain = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const owner = privateKeyToAccount(process.env.PRIVATE_KEY);
const agent = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const amount = process.argv[2] || "0.003";

const pub = createPublicClient({ chain, transport: http(rpc) });
const wallet = createWalletClient({ account: owner, chain, transport: http(rpc) });

const show = async (label) => {
  console.log(label, "deployer", formatEther(await pub.getBalance({ address: owner.address })), "BTC");
  console.log(label, "agent   ", formatEther(await pub.getBalance({ address: agent.address })), "BTC");
};

await show("before");
const hash = await wallet.sendTransaction({ to: agent.address, value: parseEther(amount) });
console.log("tx", hash);
await pub.waitForTransactionReceipt({ hash });
await show("after");
