import chai from "chai"
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { solidity } from "ethereum-waffle"
import { JsonRpcSigner } from "@ethersproject/providers/lib/json-rpc-provider";
import { IUniswapV2 } from "../typechain-types/contracts/interfaces/IUniswapV2"
import { Staking } from "../typechain-types/contracts/Staking"
import { XXXToken } from "../typechain-types/contracts/XXXToken"

chai.use(solidity);

export default function() {
  let DAOVotings;
  let DAOVotingsInterface: Contract;
  let IUNIV2: Contract;
  let Staking: Contract;
  let XXXToken: Contract;
  let TokenOwner: JsonRpcSigner;
  let Admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let XXXTokenAddress = "0x125281199964620d35d63886F492b79415926661"
  let UNIV2Address = "0xda6F7786E2b62DdD7d1dD848902Cc49b68805e0a"
  let StakingAddress = "0xE189b83A668E41231af9753705748261018AC59c"
  const oneLPToken: BigNumber = ethers.utils.parseEther("1")
  let ADMIN = "0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42"
  let BURNER_ROLE = "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848"

  beforeEach(async function() {
    await ethers.provider.send("hardhat_impersonateAccount", ["0xa162b39f86a7341948a2e0a8dac3f0dff071d509"]);
    TokenOwner = ethers.provider.getSigner("0xa162b39f86a7341948a2e0a8dac3f0dff071d509")

    DAOVotings = await ethers.getContractFactory("DAOVotings");
    [Admin, user1, user2] = await ethers.getSigners();
    DAOVotingsInterface = await DAOVotings.deploy(StakingAddress, 2000000000000000);
    await DAOVotingsInterface.deployed();

    IUNIV2 = <IUniswapV2>(await ethers.getContractAt("IUniswapV2", UNIV2Address))
    Staking = <Staking>(await ethers.getContractAt("Staking", StakingAddress))
    XXXToken = <XXXToken>(await ethers.getContractAt("XXXToken", XXXTokenAddress))
    await Staking.connect(TokenOwner).setDAOAddress(DAOVotingsInterface.address)

    await IUNIV2.connect(TokenOwner).transfer(user1.address, oneLPToken)
    await IUNIV2.connect(TokenOwner).transfer(user2.address, oneLPToken)

    await XXXToken.connect(TokenOwner).grantRole(ADMIN, DAOVotingsInterface.address)
    await XXXToken.connect(TokenOwner).grantRole(BURNER_ROLE, DAOVotingsInterface.address)
  });

  afterEach(async function() {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
            blockNumber: 6997082
          },
        },
      ],
    });
  })

  async function passDurationTime() {
    await ethers.provider.send("evm_increaseTime", [259201]) // pass duration time
    await ethers.provider.send("evm_mine", [])
  }

  async function getLastBlockTime() {
    const blockNumAfter = await ethers.provider.getBlockNumber();
    const blockAfter = await ethers.provider.getBlock(blockNumAfter);
    return blockAfter.timestamp;
  }

  describe("Public getter functions", function() {
    it("Should return chairman address", async function() {
      expect(await DAOVotingsInterface.chairman()).to.equal(Admin.address)
    })

    it("Should return Staking address", async function() {
      expect(await DAOVotingsInterface.stakingAddress()).to.equal(StakingAddress)
    })

    it("Should return minimumDuration", async function() {
      expect(await DAOVotingsInterface.minimumDuration()).to.equal(60*60*24*3)
    })

    it("Should return minimum quorum value", async function() {
      expect(await DAOVotingsInterface.minimumQuorum()).to.equal("2000000000000000")
    })

    it("Should return current voting index '0' ", async function() {
      expect(await DAOVotingsInterface.getLastIndex()).to.equal("0")
    })
  })

  describe("setMinimumQuorum function", function() {
    it("Should throw error 'SenderDontHasRights' with args", async function() {
      expect(DAOVotingsInterface.connect(user1).setMinimumQuorum(100)).to.be.revertedWith(`SenderDontHasRights("${user1.address}")`)
    })

    it("Chairman or Admin can change minumumQuorum value", async function() {
      await DAOVotingsInterface.setMinimumQuorum(100)
      expect(await DAOVotingsInterface.minimumQuorum()).to.equal("100")
    })
  })

  describe("addProposal function", function() {
    it("Should throw error 'SenderDontHasRights' with args if sender is not Admin or Chairman", async function() {
      const iface = new ethers.utils.Interface(["function transfer(address to, uint256 amount)"])
      const callData = iface.encodeFunctionData('transfer',[user1.address,100])
      expect(DAOVotingsInterface.connect(user1).addProposal(
        "Give me 100 tokens",
        0,
        XXXTokenAddress,
        callData
      )).to.be.revertedWith(`SenderDontHasRights("${user1.address}")`)
    })

    it("Should add a new proposal voting with certain parameters", async function() {
      const iface = new ethers.utils.Interface(["function transfer(address to, uint256 amount)"])
      const callData = iface.encodeFunctionData('transfer',[user1.address,100])
      await DAOVotingsInterface.connect(Admin).addProposal(
        "Give me 100 tokens",
        259200,
        XXXTokenAddress,
        callData
      )
      const proposal = await DAOVotingsInterface.getProposal(1)

      const timestampAfter = await getLastBlockTime()

      expect(proposal[0]).to.be.equal("Give me 100 tokens")
      expect(proposal[3]).to.be.equal(`${259200 + timestampAfter}`)
      expect(proposal[4]).to.be.equal(XXXTokenAddress)
      expect(proposal[5]).to.be.equal(callData)
    })

    it("If duration is less then minimumDuration value, it would be set", async function() {
      const iface = new ethers.utils.Interface(["function transfer(address to, uint256 amount)"])
      const callData = iface.encodeFunctionData('transfer',[user1.address,100])
      await DAOVotingsInterface.connect(Admin).addProposal(
        "Give me 100 tokens",
        0,
        XXXTokenAddress,
        callData
      )
      const proposal = await DAOVotingsInterface.getProposal(1)
      const timestampAfter = await getLastBlockTime()
      expect(proposal[3]).to.be.equal(`${259200 + timestampAfter}`)
    })
  })

  describe("startChairmanElection function", function() {
    it("Should throw error 'SenderDontHasRights' with args", async function() {
      expect(DAOVotingsInterface.connect(user1).changeChairman(user1.address)).to.be.revertedWith("Must called throw proposal")
    })

    it("Admin can start election for a new Chairman, and it would change after finishProposal", async function() {
      await DAOVotingsInterface.startChairmanElection(user1.address, 259200)

      await IUNIV2.connect(TokenOwner).approve(Staking.address, oneLPToken)
      await Staking.connect(TokenOwner).stake(oneLPToken)
      await DAOVotingsInterface.connect(TokenOwner).vote(1, oneLPToken, true)

      await IUNIV2.connect(user1).approve(Staking.address, oneLPToken)
      await Staking.connect(user1).stake(oneLPToken)
      await DAOVotingsInterface.connect(user1).vote(1, oneLPToken, true)

      await IUNIV2.connect(user2).approve(Staking.address, oneLPToken)
      await Staking.connect(user2).stake(oneLPToken)
      await DAOVotingsInterface.connect(user2).vote(1, oneLPToken, true)

      await passDurationTime();
      
      await DAOVotingsInterface.connect(user2).finishProposal(1)

      expect(await DAOVotingsInterface.chairman()).to.equal(user1.address)
    })
  })

  describe("vote function", function() {
    beforeEach(async function() {
      await DAOVotingsInterface.startChairmanElection(user1.address, 259200)

      await IUNIV2.connect(TokenOwner).approve(Staking.address, oneLPToken)
      await Staking.connect(TokenOwner).stake(oneLPToken)
      
      await IUNIV2.connect(user1).approve(Staking.address, oneLPToken)
      await Staking.connect(user1).stake(oneLPToken)
      
      await IUNIV2.connect(user2).approve(Staking.address, oneLPToken)
      await Staking.connect(user2).stake(oneLPToken)
    });

    it("Amount can not be more then voting power(deposited tokens) of voter", async function() {
      expect(DAOVotingsInterface.connect(user1).vote(1, 9000000000000000, true)).to.be.revertedWith("Not enough deposited tokens")
    })

    it("User can not vote in already ended votings", async function() {
      await DAOVotingsInterface.connect(TokenOwner).vote(1, oneLPToken, false)
      await DAOVotingsInterface.connect(user1).vote(1, oneLPToken, true)
      await DAOVotingsInterface.connect(user2).vote(1, oneLPToken, true)
      
      await passDurationTime();
      await DAOVotingsInterface.connect(user2).finishProposal(1)

      expect(DAOVotingsInterface.connect(user1).vote(1, oneLPToken, true)).to.be.revertedWith("Voting have been ended")
    })

    it("If debating period time is more then unstake time, it would be updated to debating period", async function() {
      const iface = new ethers.utils.Interface(["function transfer(address to, uint256 amount)"])
      const callData = iface.encodeFunctionData('transfer',[user1.address,100])
      await DAOVotingsInterface.addProposal(
        "Give me 100 tokens",
        999000,
        XXXTokenAddress,
        callData
      )

      await DAOVotingsInterface.connect(user1).vote(2, oneLPToken, true)
      const voterInfo = await Staking.stakingProviders(user1.address)
      const proposalDuration = await DAOVotingsInterface.getProposal(2)
      
      expect(+ethers.utils.formatUnits(voterInfo[2],0)).to.be.equal(+ethers.utils.formatUnits(proposalDuration[3],0))
    })

    it("User can not vote twice at one poposal voting", async function() {
      await DAOVotingsInterface.connect(user1).vote(1, oneLPToken, true)

      expect(DAOVotingsInterface.connect(user1).vote(1, oneLPToken, true)).to.be.revertedWith("You have already voted")
    })

    it("If conditions are met, user can vote 'true' or 'false' in each proposals with all voting power", async function() {
      const iface = new ethers.utils.Interface(["function transfer(address to, uint256 amount)"])
      const callData = iface.encodeFunctionData('transfer',[user1.address,100])
      await DAOVotingsInterface.addProposal(
        "Give me 100 tokens",
        259200,
        XXXTokenAddress,
        callData
      )

      await DAOVotingsInterface.startChairmanElection(user1.address, 259200)
      await DAOVotingsInterface.connect(user1).vote(1, oneLPToken, true)
      await DAOVotingsInterface.connect(user1).vote(2, oneLPToken, true)

      expect(await DAOVotingsInterface.getVotes(1, user1.address)).to.be.equal("1000000000000000000")
      expect(await DAOVotingsInterface.getVotes(2, user1.address)).to.be.equal("1000000000000000000")
    })
  })

  describe("finishProposal function", function() {
    beforeEach(async function() {
      await DAOVotingsInterface.startChairmanElection(user1.address, 259200)

      const iface = new ethers.utils.Interface(["function transfer(address to, uint256 amount)"])
      const callData = iface.encodeFunctionData('transfer',[user1.address,100])

      await XXXToken.connect(TokenOwner).transfer(DAOVotingsInterface.address, ethers.utils.parseEther("100"))
      await DAOVotingsInterface.addProposal(
        "Give me 100 tokens",
        259200,
        XXXTokenAddress,
        callData
      )

      await IUNIV2.connect(TokenOwner).approve(Staking.address, oneLPToken)
      await Staking.connect(TokenOwner).stake(oneLPToken)
      
      await IUNIV2.connect(user1).approve(Staking.address, oneLPToken)
      await Staking.connect(user1).stake(oneLPToken)
      
      await IUNIV2.connect(user2).approve(Staking.address, oneLPToken)
      await Staking.connect(user2).stake(oneLPToken)
    });

    it("Revert if debationg period didnt pass", async function() {
      expect(DAOVotingsInterface.connect(user1).finishProposal(1)).to.be.revertedWith("Debating period didnt pass")
    })

    it("Revert if proposal was already finished and called", async function() {
      await DAOVotingsInterface.connect(user1).vote(2, oneLPToken, true)
      await DAOVotingsInterface.connect(user2).vote(2, oneLPToken, true)
      await DAOVotingsInterface.connect(TokenOwner).vote(2, oneLPToken, true)

      await passDurationTime();
      await DAOVotingsInterface.connect(user2).finishProposal(2)

      expect(DAOVotingsInterface.connect(user2).finishProposal(2)).to.be.revertedWith("Proposal voting was already finished or not accepted")
    })

    it("Revert with custom error 'MinimalVotingQuorum(1, 2000000000000000)' if voting quorum is less then minimal", async function() {
      await DAOVotingsInterface.connect(user1).vote(2, oneLPToken, true)
      await DAOVotingsInterface.connect(user2).vote(2, oneLPToken, true)

      await passDurationTime();

      expect(DAOVotingsInterface.connect(user2).finishProposal(2)).to.be.revertedWith("MinimalVotingQuorum(2, 2000000000000000)")
    })

    it("If conditions are met proposal would be called with callData", async function() {
      await DAOVotingsInterface.connect(user1).vote(2, oneLPToken, true)
      await DAOVotingsInterface.connect(user2).vote(2, oneLPToken, true)
      await DAOVotingsInterface.connect(TokenOwner).vote(2, oneLPToken, true)

      await passDurationTime();
      await DAOVotingsInterface.connect(user2).finishProposal(2)

      expect(await XXXToken.balanceOf(user1.address)).to.be.equal("100")
    })
  })

  describe("increaseXXXprice function", function() {
    beforeEach(async function() {
      const iface = new ethers.utils.Interface(["function increaseXXXprice()"])
      const callData = iface.encodeFunctionData('increaseXXXprice',[])

      await DAOVotingsInterface.addProposal(
        "Lets swap XXX/ETH and burn XXX tokens",
        259200,
        DAOVotingsInterface.address,
        callData
      )

      await IUNIV2.connect(TokenOwner).approve(Staking.address, oneLPToken)
      await Staking.connect(TokenOwner).stake(oneLPToken)
      
      await IUNIV2.connect(user1).approve(Staking.address, oneLPToken)
      await Staking.connect(user1).stake(oneLPToken)
      
      await IUNIV2.connect(user2).approve(Staking.address, oneLPToken)
      await Staking.connect(user2).stake(oneLPToken)
    });

    it("Should return 'true' if deployer has role 'ADMIN'", async function () {
      expect (await XXXToken.hasRole(ADMIN, DAOVotingsInterface.address)).to.equal(true)
    })

    it("Should return 'true' if deployer has role 'BURNER_ROLE'", async function () {
      expect (await XXXToken.hasRole(BURNER_ROLE, DAOVotingsInterface.address)).to.equal(true)
    })

    it("Should throw error 'SenderDontHasRights' with args", async function() {
      expect(DAOVotingsInterface.connect(user1).increaseXXXprice()).to.be.revertedWith("Must called throw proposal")
    })

    it("Should swap ETH for XXX tokens and burn them", async function() {
      await Admin.sendTransaction({
        to: DAOVotingsInterface.address,
        value: ethers.utils.parseEther("0.01")
      })
      await DAOVotingsInterface.connect(user1).vote(1, oneLPToken, true)
      await DAOVotingsInterface.connect(user2).vote(1, oneLPToken, true)
      await DAOVotingsInterface.connect(TokenOwner).vote(1, oneLPToken, true)

      await passDurationTime();
      await DAOVotingsInterface.connect(user2).finishProposal(1)

      expect(await DAOVotingsInterface.getBalance()).to.be.equal("0")
    })
  })
}