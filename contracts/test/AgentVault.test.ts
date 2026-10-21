import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const BTC = (n: string) => ethers.parseEther(n);
const USD = (n: string) => ethers.parseEther(n);
const ICR = (n: string) => ethers.parseEther(n);

describe("AgentVault", () => {
  async function deployFixture() {
    const [owner, agent, stranger] = await ethers.getSigners();

    const feed = await ethers.deployContract("MockPriceFeed", [USD("100000")]);
    const musd = await ethers.deployContract("MockMUSD");
    const troveManager = await ethers.deployContract("MockTroveManager", [
      await feed.getAddress(),
    ]);
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

    await factory.createVault(agent.address, ICR("1.5"), ICR("2"));
    const vaultAddress = (await factory.getVaults(owner.address))[0];
    const vault = await ethers.getContractAt("AgentVault", vaultAddress);

    return { owner, agent, stranger, feed, musd, troveManager, borrowerOps, factory, vault };
  }

  it("creates an isolated vault per owner with an agent", async () => {
    const { owner, agent, factory, vault } = await loadFixture(deployFixture);
    expect(await vault.owner()).to.equal(owner.address);
    expect(await vault.agent()).to.equal(agent.address);
    expect(await vault.autoProtect()).to.equal(true);
    expect(await factory.vaultCount()).to.equal(1n);
    expect(await factory.getVaults(owner.address)).to.deep.equal([await vault.getAddress()]);
  });

  it("opens a loan and sends MUSD to the owner", async () => {
    const { owner, vault, musd } = await loadFixture(deployFixture);
    await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });

    const h = await vault.health();
    expect(h.coll).to.equal(BTC("1"));
    expect(h.debt).to.equal(USD("20000"));
    expect(h.price).to.equal(USD("100000"));
    expect(h.icr).to.equal(ICR("5"));
    expect(h.status).to.equal(1n);
    expect(await musd.balanceOf(owner.address)).to.equal(USD("20000"));
  });

  it("agent tops up collateral from the vault buffer on a crash", async () => {
    const { owner, agent, vault, feed } = await loadFixture(deployFixture);
    await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
    await owner.sendTransaction({ to: await vault.getAddress(), value: BTC("0.25") });

    await feed.setPrice(USD("26000")); // ICR = 1.30

    await expect(vault.connect(agent).protect(0, BTC("0.2")))
      .to.emit(vault, "AgentAction")
      .withArgs(1, 0, BTC("0.2"), USD("26000"), ICR("1.3"), ICR("1.56"));

    const h = await vault.health();
    expect(h.coll).to.equal(BTC("1.2"));
    expect(h.icr).to.equal(ICR("1.56"));
    expect(h.btcBuffer).to.equal(BTC("0.05"));
  });

  it("agent repays debt from the MUSD reserve on a crash", async () => {
    const { owner, agent, vault, musd, feed } = await loadFixture(deployFixture);
    await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
    await musd.connect(owner).approve(await vault.getAddress(), USD("10000"));
    await vault.connect(owner).fundReserve(USD("10000"));

    await feed.setPrice(USD("26000")); // ICR = 1.30
    await vault.connect(agent).protect(USD("5000"), 0);

    const h = await vault.health();
    expect(h.debt).to.equal(USD("15000"));
    expect(h.icr).to.equal(ICR("1.733333333333333333"));
    expect(h.musdReserve).to.equal(USD("5000"));
  });

  it("only the agent can protect, and the owner can pause it", async () => {
    const { owner, agent, stranger, vault } = await loadFixture(deployFixture);
    await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });

    await expect(vault.connect(stranger).protect(0, 0)).to.be.revertedWith(
      "AgentVault: not agent",
    );

    await vault.connect(owner).setRules(ICR("1.5"), ICR("2"), false);
    await expect(vault.connect(agent).protect(0, 0)).to.be.revertedWith(
      "AgentVault: paused",
    );
  });

  it("validates rule bounds", async () => {
    const { owner, vault } = await loadFixture(deployFixture);
    await expect(
      vault.connect(owner).setRules(ICR("1.05"), ICR("2"), true),
    ).to.be.revertedWith("AgentVault: trigger too low");
    await expect(
      vault.connect(owner).setRules(ICR("2"), ICR("1.5"), true),
    ).to.be.revertedWith("AgentVault: target < trigger");
  });

  it("keeps owner-only actions owner-only", async () => {
    const { agent, vault } = await loadFixture(deployFixture);
    await expect(
      vault.connect(agent).openLoan(USD("20000"), { value: BTC("1") }),
    ).to.be.revertedWith("AgentVault: not owner");
    await expect(vault.connect(agent).closeLoan()).to.be.revertedWith(
      "AgentVault: not owner",
    );
    await expect(
      vault.connect(agent).setRules(ICR("1.5"), ICR("2"), true),
    ).to.be.revertedWith("AgentVault: not owner");
  });

  it("closes the loan and returns collateral to the owner", async () => {
    const { owner, vault, musd } = await loadFixture(deployFixture);
    await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
    await musd.connect(owner).approve(await vault.getAddress(), USD("20000"));
    await vault.connect(owner).fundReserve(USD("20000"));

    await expect(vault.connect(owner).closeLoan()).to.changeEtherBalance(
      owner,
      BTC("1"),
    );

    const h = await vault.health();
    expect(h.status).to.equal(2n);
    expect(h.coll).to.equal(0n);
  });
});
