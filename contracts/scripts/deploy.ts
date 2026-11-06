import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { CORE, FEES } from "./constants";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network:  ${network.name} (chainId ${network.chainId})`);
  console.log(`Balance:  ${ethers.formatEther(balance)} BTC`);

  if (balance === 0n) {
    throw new Error("Deployer has no testnet BTC. Use https://faucet.test.mezo.org");
  }

  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  console.log(`Stability Pool: ${CORE.STABILITY_POOL}`);
  console.log(`Fees: ${FEES.PROTECT_FEE_BPS / 100}% per protect, ${FEES.PERFORMANCE_FEE_BPS / 100}% of pool gains -> ${feeRecipient}`);

  const args = [
    CORE.MUSD,
    CORE.BORROWER_OPERATIONS,
    CORE.TROVE_MANAGER,
    CORE.PRICE_FEED,
    CORE.STABILITY_POOL,
    feeRecipient,
    FEES.PROTECT_FEE_BPS,
    FEES.PERFORMANCE_FEE_BPS,
  ] as const;
  const factory = await ethers.deployContract("AgentVaultFactory", [...args]);
  await factory.waitForDeployment();
  const address = await factory.getAddress();

  console.log(`\nAgentVaultFactory: ${address}`);
  console.log(`Explorer: ${network.chainId === 31611n ? "https://explorer.test.mezo.org" : ""}/address/${address}`);

  const outDir = path.resolve(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${network.chainId}.json`);
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const payload = {
    chainId: Number(network.chainId),
    network: "Mezo Testnet",
    version: "2.0.0",
    factory: address,
    factoryArgs: args,
    fees: { protectFeeBps: FEES.PROTECT_FEE_BPS, performanceFeeBps: FEES.PERFORMANCE_FEE_BPS, recipient: feeRecipient },
    core: CORE,
    explorer: "https://explorer.test.mezo.org",
    wave1: previous.factory && previous.factory !== address
      ? { factory: previous.factory, demoVault: previous.demoVault }
      : previous.wave1,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${file}`);
  console.log(`\nVerify: pnpm --filter @agentvault/contracts verify:testnet`);
  console.log(`\nAdd to .env:\nFACTORY_ADDRESS=${address}\nNEXT_PUBLIC_FACTORY_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
