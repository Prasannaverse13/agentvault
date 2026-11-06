import { ethers, run } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Verifies the v2 factory and any vaults on the Mezo testnet explorer.
 *
 *   pnpm --filter @agentvault/contracts verify:testnet
 *   VAULTS=0xabc,0xdef pnpm --filter @agentvault/contracts verify:testnet
 *
 * Vault constructor arguments are rebuilt from the vault's own state. If the
 * owner later changed the agent or rules, pass the original values with
 * VAULT_AGENT / VAULT_TRIGGER / VAULT_TARGET.
 */
async function verify(address: string, constructorArguments: unknown[], contract?: string) {
  try {
    await run("verify:verify", { address, constructorArguments, contract });
    console.log(`Verified ${address}`);
  } catch (error) {
    const msg = (error as Error).message ?? String(error);
    if (/already verified/i.test(msg)) console.log(`Already verified ${address}`);
    else console.error(`Could not verify ${address}: ${msg}`);
  }
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const file = path.resolve(__dirname, `../deployments/${network.chainId}.json`);
  const dep = JSON.parse(fs.readFileSync(file, "utf8"));

  console.log(`Factory ${dep.factory}`);
  await verify(dep.factory, dep.factoryArgs, "contracts/AgentVaultFactory.sol:AgentVaultFactory");

  const vaults = (process.env.VAULTS ?? dep.demoVault ?? "")
    .split(",")
    .map((v: string) => v.trim())
    .filter(Boolean);

  const factory = await ethers.getContractAt("AgentVaultFactory", dep.factory);
  for (const address of vaults) {
    const vault = await ethers.getContractAt("AgentVault", address);
    const config = {
      owner: await vault.owner(),
      agent: process.env.VAULT_AGENT ?? (await vault.agent()),
      musd: await factory.musd(),
      borrowerOps: await factory.borrowerOps(),
      troveManager: await factory.troveManager(),
      priceFeed: await factory.priceFeed(),
      stabilityPool: await factory.stabilityPool(),
      feeRecipient: await factory.feeRecipient(),
      protectFeeBps: await factory.protectFeeBps(),
      performanceFeeBps: await factory.performanceFeeBps(),
      triggerICR: process.env.VAULT_TRIGGER ?? (await vault.triggerICR()),
      targetICR: process.env.VAULT_TARGET ?? (await vault.targetICR()),
      autoProtect: true,
    };
    console.log(`Vault ${address}`);
    await verify(address, [config], "contracts/AgentVault.sol:AgentVault");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
