import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const BTC = (n: string) => ethers.parseEther(n);
const USD = (n: string) => ethers.parseEther(n);
const ICR = (n: string) => ethers.parseEther(n);

async function baseFixture(protectFeeBps: number, performanceFeeBps: number) {
    const [owner, agent, stranger, treasury] = await ethers.getSigners();

    const feed = await ethers.deployContract("MockPriceFeed", [USD("100000")]);
    const musd = await ethers.deployContract("MockMUSD");
    const troveManager = await ethers.deployContract("MockTroveManager", [
      await feed.getAddress(),
    ]);
    const borrowerOps = await ethers.deployContract("MockBorrowerOperations", [
      await musd.getAddress(),
      await troveManager.getAddress(),
    ]);

    const pool = await ethers.deployContract("MockStabilityPool", [await musd.getAddress()]);

    const factory = await ethers.deployContract("AgentVaultFactory", [
      await musd.getAddress(),
      await borrowerOps.getAddress(),
      await troveManager.getAddress(),
      await feed.getAddress(),
      await pool.getAddress(),
      treasury.address,
      protectFeeBps,
      performanceFeeBps,
    ]);

    await factory.createVault(agent.address, ICR("1.5"), ICR("2"));
    const vaultAddress = (await factory.getVaults(owner.address))[0];
    const vault = await ethers.getContractAt("AgentVault", vaultAddress);

    return { owner, agent, stranger, treasury, feed, musd, troveManager, borrowerOps, pool, factory, vault };
}

/** No fees: keeps the v1 maths exact. */
async function deployFixture() {
  return baseFixture(0, 0);
}

/** Production fee terms: 0.5% per protect action, 10% of Stability Pool BTC gains. */
async function feeFixture() {
  return baseFixture(50, 1_000);
}

describe("AgentVault", () => {

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

  // -------------------------------------------------------------------------
  // v2: Wave 2 features
  // -------------------------------------------------------------------------

  describe("v2: surplus recovery after redemption", () => {
    it("claims CollSurplusPool BTC for the owner when the agent calls claimSurplus", async () => {
      const { owner, agent, vault, borrowerOps } = await loadFixture(deployFixture);
      await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
      await borrowerOps.simulateRedemption(await vault.getAddress(), { value: BTC("0.3") });

      await expect(vault.connect(agent).claimSurplus())
        .to.emit(vault, "SurplusClaimed")
        .withArgs(agent.address, owner.address, BTC("0.3"));
      expect((await vault.earnInfo()).surplusClaimed).to.equal(BTC("0.3"));

      await expect(vault.connect(agent).claimSurplus()).to.be.revertedWith(
        "CollSurplusPool: No collateral available to claim",
      );
    });

    it("sends surplus to the owner, refuses strangers and active loans", async () => {
      const { owner, stranger, vault, borrowerOps } = await loadFixture(deployFixture);
      await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
      await expect(vault.connect(owner).claimSurplus()).to.be.revertedWith("AgentVault: loan active");

      await borrowerOps.simulateRedemption(await vault.getAddress(), { value: BTC("0.2") });
      await expect(vault.connect(stranger).claimSurplus()).to.be.revertedWith(
        "AgentVault: not owner or agent",
      );
      await expect(vault.connect(owner).claimSurplus()).to.changeEtherBalance(owner, BTC("0.2"));
    });
  });

  describe("v2: repay cap at Mezo's minimum net debt", () => {
    it("caps protect() so it never trips BorrowerOps' min debt check", async () => {
      const { owner, agent, vault, musd, feed, borrowerOps } = await loadFixture(deployFixture);
      await borrowerOps.setMinNetDebt(USD("1800"));
      await vault.connect(owner).openLoan(USD("3000"), { value: BTC("0.05") }); // ICR 1.666
      await musd.connect(owner).approve(await vault.getAddress(), USD("3000"));
      await vault.connect(owner).fundReserve(USD("3000"));

      // 3000 debt - 200 gas compensation - 1800 minimum = 1000 MUSD maximum.
      expect(await vault.maxRepay()).to.equal(USD("1000"));

      await feed.setPrice(USD("70000")); // ICR 1.1666
      await expect(vault.connect(agent).protect(USD("3000"), 0))
        .to.emit(vault, "DebtRepaid")
        .withArgs(await vault.getAddress(), USD("1000"));

      const h = await vault.health();
      expect(h.debt).to.equal(USD("2000"));
      expect(await vault.maxRepay()).to.equal(0n);
      // A second call with no repay room and no buffer is a no-op, not a revert.
      await expect(vault.connect(agent).protect(USD("500"), 0)).to.not.be.reverted;
    });
  });

  describe("v2: Earn in the Mezo Stability Pool", () => {
    async function pooledFixture() {
      const f = await deployFixture();
      const { owner, vault, musd } = f;
      await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
      await musd.connect(owner).approve(await vault.getAddress(), USD("10000"));
      await vault.connect(owner).fundReserve(USD("10000"));
      await vault.connect(owner).earnDeposit(USD("10000"));
      return f;
    }

    it("moves the idle reserve into the Stability Pool", async () => {
      const { vault, pool } = await loadFixture(pooledFixture);
      const info = await vault.earnInfo();
      expect(info.pooledMusd).to.equal(USD("10000"));
      expect((await vault.health()).musdReserve).to.equal(0n);
      expect(await pool.deposits(await vault.getAddress())).to.equal(USD("10000"));
    });

    it("lets the agent deposit idle reserve but not strangers", async () => {
      const { owner, agent, stranger, vault, musd } = await loadFixture(deployFixture);
      await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
      await musd.connect(owner).approve(await vault.getAddress(), USD("1000"));
      await vault.connect(owner).fundReserve(USD("1000"));
      await expect(vault.connect(stranger).earnDeposit(USD("1000"))).to.be.revertedWith(
        "AgentVault: not owner or agent",
      );
      await expect(vault.connect(agent).earnDeposit(USD("5000")))
        .to.emit(vault, "EarnDeposited")
        .withArgs(agent.address, USD("1000"));
    });

    it("protect() unwinds the pool to repay during a crash", async () => {
      const { agent, vault, feed } = await loadFixture(pooledFixture);
      await feed.setPrice(USD("26000")); // ICR 1.30

      await expect(vault.connect(agent).protect(USD("5000"), 0))
        .to.emit(vault, "EarnWithdrawn")
        .withArgs(agent.address, USD("5000"), 0);

      const h = await vault.health();
      expect(h.debt).to.equal(USD("15000"));
      expect((await vault.earnInfo()).pooledMusd).to.equal(USD("5000"));
    });

    it("falls back to the BTC buffer when Mezo blocks pool withdrawals", async () => {
      const { owner, agent, vault, feed, pool } = await loadFixture(pooledFixture);
      await owner.sendTransaction({ to: await vault.getAddress(), value: BTC("0.25") });
      await pool.setUnderCollateralizedTroves(true);
      await feed.setPrice(USD("26000"));

      await expect(vault.connect(agent).protect(USD("5000"), BTC("0.2")))
        .to.emit(vault, "EarnUnwindFailed")
        .withArgs(USD("5000"))
        .and.to.emit(vault, "AgentAction")
        .withArgs(1, 0, BTC("0.2"), USD("26000"), ICR("1.3"), ICR("1.56"));
    });

    it("a pool that burns all gas cannot stop the rescue", async () => {
      const { owner, agent, vault, feed, pool } = await loadFixture(pooledFixture);
      await owner.sendTransaction({ to: await vault.getAddress(), value: BTC("0.25") });
      await pool.setBurnGas(true);
      await feed.setPrice(USD("26000"));

      // A tight gas limit: without the unwind gas cap the pool eats 63/64 of it.
      await expect(vault.connect(agent).protect(USD("5000"), BTC("0.2"), { gasLimit: 1_900_000 }))
        .to.emit(vault, "EarnUnwindFailed")
        .and.to.emit(vault, "AgentAction");
    });

    it("harvest() turns liquidation gains into collateral", async () => {
      const { agent, vault, pool, troveManager } = await loadFixture(pooledFixture);
      const v = await vault.getAddress();
      await pool.simulateLiquidation(v, USD("1000"), { value: BTC("0.012") });

      expect((await vault.earnInfo()).pendingBtcGain).to.equal(BTC("0.012"));
      await expect(vault.connect(agent).harvest())
        .to.emit(vault, "Harvested")
        .withArgs(agent.address, BTC("0.012"), BTC("0.012"), 0);

      expect(await troveManager.getTroveColl(v)).to.equal(BTC("1.012"));
      const info = await vault.earnInfo();
      expect(info.earnedBtc).to.equal(BTC("0.012"));
      expect(info.pooledMusd).to.equal(USD("9000"));
    });

    it("earnWithdraw is owner only and brings MUSD back as liquid reserve", async () => {
      const { owner, agent, vault } = await loadFixture(pooledFixture);
      await expect(vault.connect(agent).earnWithdraw(USD("1"))).to.be.revertedWith(
        "AgentVault: not owner",
      );
      await vault.connect(owner).earnWithdraw(USD("4000"));
      expect((await vault.health()).musdReserve).to.equal(USD("4000"));
      expect((await vault.earnInfo()).pooledMusd).to.equal(USD("6000"));
    });

    it("closeLoan pulls pooled MUSD back to pay the debt and returns the rest", async () => {
      const { owner, vault, musd } = await loadFixture(pooledFixture);
      // Owner holds 10000 MUSD after funding; pool holds 10000; debt is 20000.
      await musd.connect(owner).approve(await vault.getAddress(), USD("10000"));
      await vault.connect(owner).fundReserve(USD("10000"));
      await vault.connect(owner).closeLoan();
      expect((await vault.health()).status).to.equal(2n);
      expect((await vault.earnInfo()).pooledMusd).to.equal(0n);
      expect(await musd.balanceOf(await vault.getAddress())).to.equal(0n);
    });

    it("unwindForProtect cannot be called from outside", async () => {
      const { agent, vault } = await loadFixture(pooledFixture);
      await expect(vault.connect(agent).unwindForProtect(USD("1"))).to.be.revertedWith(
        "AgentVault: internal",
      );
    });
  });

  describe("v2: fees", () => {
    it("charges 0.5% on protect actions to the treasury", async () => {
      const { owner, agent, treasury, vault, musd, feed } = await loadFixture(feeFixture);
      await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
      await owner.sendTransaction({ to: await vault.getAddress(), value: BTC("0.25") });
      await musd.connect(owner).approve(await vault.getAddress(), USD("10000"));
      await vault.connect(owner).fundReserve(USD("10000"));
      await feed.setPrice(USD("26000"));

      await expect(vault.connect(agent).protect(USD("2000"), BTC("0.1")))
        .to.emit(vault, "FeePaid")
        .withArgs(treasury.address, BTC("0.0005"), USD("10"));
      expect(await musd.balanceOf(treasury.address)).to.equal(USD("10"));
      const info = await vault.earnInfo();
      expect(info.feesBtc).to.equal(BTC("0.0005"));
      expect(info.feesMusd).to.equal(USD("10"));
    });

    it("takes a 10% performance fee on Stability Pool gains", async () => {
      const { owner, agent, treasury, vault, musd, pool, troveManager } = await loadFixture(feeFixture);
      await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
      await musd.connect(owner).approve(await vault.getAddress(), USD("5000"));
      await vault.connect(owner).fundReserve(USD("5000"));
      await vault.connect(owner).earnDeposit(USD("5000"));
      const v = await vault.getAddress();
      await pool.simulateLiquidation(v, USD("500"), { value: BTC("0.01") });

      await expect(vault.connect(agent).harvest()).to.changeEtherBalance(treasury, BTC("0.001"));
      expect(await troveManager.getTroveColl(v)).to.equal(BTC("1.009"));
    });

    it("scales a rescue down so the fee never makes it fail", async () => {
      const { owner, agent, vault, feed } = await loadFixture(feeFixture);
      await vault.connect(owner).openLoan(USD("20000"), { value: BTC("1") });
      await owner.sendTransaction({ to: await vault.getAddress(), value: BTC("0.1005") });
      await feed.setPrice(USD("26000"));
      // Ask for more than the buffer holds: the vault tops up 0.1 and pays 0.0005.
      await vault.connect(agent).protect(0, BTC("0.5"));
      const h = await vault.health();
      expect(h.coll).to.equal(BTC("1.1"));
      expect(h.btcBuffer).to.equal(0n);
    });

    it("hard caps fees at deploy time", async () => {
      const [, agent, , treasury] = await ethers.getSigners();
      const factory = await ethers.deployContract("AgentVaultFactory", [
        treasury.address, treasury.address, treasury.address, treasury.address,
        ethers.ZeroAddress, treasury.address, 101, 0,
      ]);
      await expect(factory.createVault(agent.address, ICR("1.5"), ICR("2"))).to.be.revertedWith(
        "AgentVault: protect fee too high",
      );
      const factory2 = await ethers.deployContract("AgentVaultFactory", [
        treasury.address, treasury.address, treasury.address, treasury.address,
        ethers.ZeroAddress, treasury.address, 0, 2_001,
      ]);
      await expect(factory2.createVault(agent.address, ICR("1.5"), ICR("2"))).to.be.revertedWith(
        "AgentVault: performance fee too high",
      );
    });
  });
});
