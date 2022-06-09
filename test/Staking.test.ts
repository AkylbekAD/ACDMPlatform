import chai from "chai"
import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { solidity } from "ethereum-waffle"

chai.use(solidity);

export default function() {
  let Staking;
  let StakingInterface: Contract;
  let owner: SignerWithAddress;
  let acc1: SignerWithAddress;
  let acc2: SignerWithAddress;

  let DAOVotings;
  let DAOVotingsInterface: Contract;

  let TestRewardToken;
  let TestRewardTokenInterface: Contract;

  let TestLPToken;
  let TestLPTokenInterface: Contract;

  let ADMIN = "0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42"
  let BURNER_ROLE = "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848"
  let MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"

  beforeEach(async function() {
    [owner, acc1, acc2] = await ethers.getSigners()

    TestRewardToken = await ethers.getContractFactory("ACDMToken");   
    TestRewardTokenInterface = await TestRewardToken.deploy();
    await TestRewardTokenInterface.deployed()
    await TestRewardTokenInterface.mint(owner.address, 1000000000000)

    TestLPToken = await ethers.getContractFactory("XXXToken");  
    TestLPTokenInterface = await TestLPToken.deploy();
    await TestLPTokenInterface.deployed()

    Staking = await ethers.getContractFactory("Staking"); 
    StakingInterface = await Staking.deploy(TestRewardTokenInterface.address, TestLPTokenInterface.address);
    await StakingInterface.deployed()

    DAOVotings = await ethers.getContractFactory("DAOVotings"); 
    DAOVotingsInterface = await DAOVotings.deploy(StakingInterface.address, 100000);
    await DAOVotingsInterface.deployed()

    // setting DAOVotings address for checking depositDuration
    await StakingInterface.setDAOAddress(DAOVotingsInterface.address); 
  });

  async function stakeLPtokens(account: SignerWithAddress, amount: number) {
    const staking = await StakingInterface.connect(account).stake(amount)
    await staking.wait()
  }

  describe("Staking contract user functions", function() {
    beforeEach(async function () {
      await TestRewardTokenInterface.grantRole(ADMIN, StakingInterface.address)

      const transferReward = await TestRewardTokenInterface.connect(owner).transfer(StakingInterface.address, 1000000000000)
      await transferReward.wait()

      const transferLP = await TestLPTokenInterface.connect(owner).transfer(acc1.address, 1000000000000)
      await transferLP.wait()
      const approveLP = await TestLPTokenInterface.connect(acc1).approve(StakingInterface.address, 1000000000000)
      await approveLP.wait()
    });

    describe("Stake function", function() {
      it("Stake function avaliable and transfers LP tokens to contract", async function () {
        await stakeLPtokens(acc1,1000000000000)
        const stakedTokens = await StakingInterface.stakingProviders(acc1.address)
        expect(ethers.utils.formatUnits(stakedTokens[0], 0)).to.equal("1000000000000")
      })

      it("User have to stake atleast 0.00001 of UNI-V2 token", async function () {
        expect(stakeLPtokens(acc1,99999)).to.be.revertedWith("You have to stake atleast 0.00001 of UNI-V2") // have to stake atleast 100000 LP tokens
      })
    })

    describe("Claim function", function() {
      it("Claim function avaliable when staking time passed and transfers reward tokens to provider", async function () {
        await stakeLPtokens(acc1,1000000000000)

        await ethers.provider.send("evm_increaseTime", [604801]) // pass freeze time
        await ethers.provider.send("evm_mine", [])

        await StakingInterface.connect(acc1).claim() // gets reward tokens
        const rewardTokens = await TestRewardTokenInterface.connect(acc1).balanceOf(acc1.address) //balance at TestToken contract
        expect(rewardTokens).to.equal("30000000000")
      })

      it("Claim function is not avaliable if staking time didnt pass", async function () {
        await stakeLPtokens(acc1,1000000000000)
        expect(StakingInterface.connect(acc1).claim()).to.be.revertedWith("Claim time have not pass yet")
      })
    })

    describe("Unstake function", function() {
      it("Unstake function avaliable when staking time passed and transfers LP tokens to provider", async function () {
        await stakeLPtokens(acc1,100000000000)

        await ethers.provider.send("evm_increaseTime", [604801]) // pass freeze time
        await ethers.provider.send("evm_mine", [])

        await StakingInterface.connect(acc1).unstake() // gets reward tokens
        const LPTokens = await TestLPTokenInterface.connect(acc1).balanceOf(acc1.address) //balance at TestToken contract
        expect(LPTokens).to.equal("1000000000000")
      })

      it("Unstake function is not avaliable if staking time didnt pass", async function () {
        await stakeLPtokens(acc1,1000000000000)
        expect(StakingInterface.connect(acc1).unstake()).to.be.revertedWith("Unstake time have not pass yet")
      })
    })
  }) 

  describe("Getter public functions", function() {
    it("Should return reward percent from 'rewardPercent' getter function", async function() {
      expect(await StakingInterface.rewardPercent()).to.equal("3000")
    })

    it("Should return stake time from 'claimTime' getter function", async function() {
        expect(await StakingInterface.claimTime()).to.equal("604800")
      })
  })

  describe("ADMIN and CHANGER only functions", function() {
    describe("changeClaimTime function", function() {
      it("changeClaimTime function avaliable to ADMIN and sets new stake time", async function () {
        await StakingInterface.connect(owner).changeClaimTime(600) // setting new 10 min time 
        expect(await StakingInterface.claimTime()).to.equal("600")
      })

      it("changeClaimTime function is not avaliable to users without CHANGER access", async function () {
        expect(StakingInterface.connect(acc2).changeClaimTime(600)).to.be.revertedWith("You dont have rights to change it")
      })
    })

    describe("changeUnstakeTime function", function() {
      it("changeunstakeTime function avaliable to ADMIN and sets new stake time", async function () {
        await StakingInterface.connect(owner).changeUnstakeTime(600) // setting new 10 min time 
        expect(await StakingInterface.unstakeTime()).to.equal("600")
      })

      it("changeunstakeTime function is not avaliable to users without CHANGER access", async function () {
        expect(StakingInterface.connect(acc2).changeUnstakeTime(600)).to.be.revertedWith("You dont have rights to change it")
      })
    })

    describe("changeRewardPercent function", function() {
      it("changeRewardPercent function avaliable to ADMIN and sets new reward percent", async function () {
        await StakingInterface.connect(owner).changeRewardPercent(10) // setting new 10 percent reward 
        expect(await StakingInterface.rewardPercent()).to.equal("10")
      })

      it("changeRewardPercent function is not avaliable to users without CHANGER access", async function () {
        expect(StakingInterface.connect(acc2).changeRewardPercent(10)).to.be.revertedWith("You dont have rights to change it")
      })
    })

    describe("giveChangerRights function", function() {
      it("giveChangerRights function avaliable to ADMIN and gives CHANGER possibilities", async function () {
        await StakingInterface.connect(owner).giveChangerRights(acc1.address) // giving CHANGER role to acc1
        await StakingInterface.connect(acc1).changeRewardPercent(10) // setting new 10 percent reward by acc1
        expect(await StakingInterface.rewardPercent()).to.equal("10")

        await StakingInterface.connect(acc1).changeClaimTime(600) // setting new 10 min time by acc1
        expect(await StakingInterface.claimTime()).to.equal("600")
      })

      it("changeRewardPercent function is only avaliable to ADMIN", async function () {
        expect(StakingInterface.connect(acc2).giveChangerRights(acc2.address)).to.be.revertedWith("You dont have rights to change it")
      })
    })

    describe("revokeChangerRights function", function() {
      it("revokeChangerRights function avaliable to ADMIN and revokes CHANGER possibilities", async function () {
        await StakingInterface.connect(owner).giveChangerRights(acc1.address) // giving CHANGER role to acc1

        await StakingInterface.connect(acc1).changeRewardPercent(10) // setting new 10 percent reward by acc1
        expect(await StakingInterface.rewardPercent()).to.equal("10")

        await StakingInterface.connect(owner).revokeChangerRights(acc1.address) // revoke CHANGER role from acc1
        expect(StakingInterface.connect(acc1).changeRewardPercent(50)).to.be.revertedWith("You dont have rights to change it")
      })

      it("revokeChangerRights function is only avaliable to ADMIN", async function () {
        expect(StakingInterface.connect(acc2).revokeChangerRights(acc2.address)).to.be.revertedWith("You dont have rights to change it")
      })

      describe("setDAOAddress function", function() {
        it("setDAOAddress function avaliable to CHANGER and sets DAOVotings address", async function () {
          await StakingInterface.connect(owner).setDAOAddress(DAOVotingsInterface.address) // setting new 10 min time 
          expect(await StakingInterface.DAOVotingsAddress()).to.equal(DAOVotingsInterface.address)
        })
    
        it("setDAOAddress function is not avaliable to users without CHANGER access", async function () {
          expect(StakingInterface.connect(acc2).setDAOAddress(acc2.address)).to.be.revertedWith("You dont have rights to change it")
        })
      })
    })
  })

  describe("setDepositDuration function", function() {
    it("setDepositDuration function avaliable to DAO and updates users 'unstakeTime'", async function () {
      await TestLPTokenInterface.connect(owner).transfer(acc1.address, 1000000000)
      await TestLPTokenInterface.connect(acc1).approve(StakingInterface.address, 1000000000)
      /// Staking tokens to make first deposit duration time before voting
      await stakeLPtokens(acc1,1000000000)
      let durationBefore = await StakingInterface.stakingProviders(acc1.address)
      durationBefore = ethers.utils.formatUnits(durationBefore[2], 0)

      /// Passing some time
      await ethers.provider.send("evm_increaseTime", [604801]) 
      await ethers.provider.send("evm_mine", [])
      
      /// Creating proposal at DAOVotings
      const iface = new ethers.utils.Interface(["function transfer(address to, uint256 amount)"])
      const callData = iface.encodeFunctionData('transfer',[acc1.address,100])
      await DAOVotingsInterface.connect(owner).addProposal(
        "Give me 100 tokens",
        259200,
        TestLPTokenInterface.address,
        callData
      )
      
      /// Now acc1 should vote at proposal and its deposit duration would increase
      await DAOVotingsInterface.connect(acc1).vote(1, 1000000000, true)
      let durationAfter = await StakingInterface.stakingProviders(acc1.address)
      durationAfter = ethers.utils.formatUnits(durationAfter[2], 0)

      expect(+durationAfter).to.be.above(+durationBefore + 259200)
    })

    it("setDepositDuration function is not avaliable other users", async function () {
      expect(StakingInterface.connect(acc2).setDepositDuration(acc2.address, 0)).to.be.revertedWith("You dont have rights to change it")
    })
  })
}
