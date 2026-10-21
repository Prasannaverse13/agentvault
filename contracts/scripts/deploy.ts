import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { CORE } from "./constants";

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

  const factory = await ethers.deployContract("AgentVaultFactory", [
    CORE.MUSD,
    CORE.BORROWER_OPERATIONS,
    CORE.TROVE_MANAGER,
    CORE.PRICE_FEED,
  ]);
  await factory.waitForDeployment();
  const address = await factory.getAddress();

  console.log(`\nAgentVaultFactory: ${address}`);
  console.log(`Explorer: ${network.chainId === 31611n ? "https://explorer.test.mezo.org" : ""}/address/${address}`);

  const outDir = path.resolve(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${network.chainId}.json`);
  const payload = {
    chainId: Number(network.chainId),
    factory: address,
    core: CORE,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${file}`);
  console.log(`\nAdd to .env:\nFACTORY_ADDRESS=${address}\nNEXT_PUBLIC_FACTORY_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
