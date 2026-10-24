import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// Must match LOCAL_CORE / LOCAL_FACTORY in shared/src/addresses.ts.
const EXPECTED = {
  PRICE_FEED: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  MUSD: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  TROVE_MANAGER: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  BORROWER_OPERATIONS: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  FACTORY: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
};

const START_PRICE = ethers.parseEther("80000");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const nonce = await ethers.provider.getTransactionCount(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network:  chainId ${network.chainId}`);

  if (nonce !== 0) {
    throw new Error(
      "This node is not fresh (deployer nonce is not 0). Restart the demo chain so the contract addresses are deterministic.",
    );
  }

  const feed = await ethers.deployContract("MockPriceFeed", [START_PRICE]);
  const musd = await ethers.deployContract("MockMUSD");
  const troveManager = await ethers.deployContract("MockTroveManager", [await feed.getAddress()]);
  const borrowerOps = await ethers.deployContract("MockBorrowerOperations", [
    await musd.getAddress(),
    await troveManager.getAddress(),
  ]);
  const factory = await ethers.deployContract("AgentVaultFactory", [
    await musd.getAddress(),
    await borrowerOps.getAddress(),
    await troveManager.getAddress(),
    await feed.getAddress(),
  ]);

  const actual = {
    PRICE_FEED: await feed.getAddress(),
    MUSD: await musd.getAddress(),
    TROVE_MANAGER: await troveManager.getAddress(),
    BORROWER_OPERATIONS: await borrowerOps.getAddress(),
    FACTORY: await factory.getAddress(),
  };

  for (const [name, expected] of Object.entries(EXPECTED)) {
    const got = actual[name as keyof typeof actual];
    if (got.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`${name} deployed at ${got}, expected ${expected}. Update shared/src/addresses.ts.`);
    }
  }

  const outDir = path.resolve(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "31337.json"),
    JSON.stringify(
      {
        chainId: Number(network.chainId),
        network: "AgentVault Demo Network",
        factory: actual.FACTORY,
        core: {
          MUSD: actual.MUSD,
          BORROWER_OPERATIONS: actual.BORROWER_OPERATIONS,
          TROVE_MANAGER: actual.TROVE_MANAGER,
          PRICE_FEED: actual.PRICE_FEED,
        },
        deployer: deployer.address,
        startPrice: "80000",
      },
      null,
      2,
    ),
  );

  console.log("Mock Mezo + AgentVaultFactory deployed:");
  for (const [name, address] of Object.entries(actual)) console.log(`  ${name.padEnd(20)} ${address}`);
  console.log("BTC price set to $80,000");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
