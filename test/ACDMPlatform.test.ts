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
import { ACDMToken } from "../typechain-types/contracts/ACDMToken"

chai.use(solidity);

export default function() {
  let ACDMPlatform;
  let ACDMPlatformInterface: Contract;
  let DAOVotings;
  let DAOVotingsInterface: Contract;
  let IUNIV2: Contract;
  let Staking: Contract;
  let XXXToken: Contract;
  let ACDMToken: Contract;
  let TokenOwner: JsonRpcSigner;
  let Admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let XXXTokenAddress = "0x125281199964620d35d63886F492b79415926661"
  let ACDMTokenAddress = "0x2d8ecB8Dd7a70E49f70F5224AF7573078Ec20052"
  let UNIV2Address = "0xda6F7786E2b62DdD7d1dD848902Cc49b68805e0a"
  let StakingAddress = "0x1332358eE095635EC7e1D37cc86AFaA5b0421c01"

  beforeEach(async function() {
    await ethers.provider.send("hardhat_impersonateAccount", ["0xa162b39f86a7341948a2e0a8dac3f0dff071d509"]);
    TokenOwner = ethers.provider.getSigner("0xa162b39f86a7341948a2e0a8dac3f0dff071d509")

    DAOVotings = await ethers.getContractFactory("DAOVotings");
    DAOVotingsInterface = await DAOVotings.deploy(StakingAddress, 2000000000000000);
    await DAOVotingsInterface.deployed();

    ACDMPlatform = await ethers.getContractFactory("ACDMPlatform");
    [Admin, user1, user2] = await ethers.getSigners();
    ACDMPlatformInterface = await ACDMPlatform.deploy(DAOVotingsInterface.address, ACDMTokenAddress, 1000);
    await ACDMPlatformInterface.deployed();

    IUNIV2 = <IUniswapV2>(await ethers.getContractAt("IUniswapV2", UNIV2Address))
    Staking = <Staking>(await ethers.getContractAt("Staking", StakingAddress))
    XXXToken = <XXXToken>(await ethers.getContractAt("XXXToken", XXXTokenAddress))
    ACDMToken = <ACDMToken>(await ethers.getContractAt("ACDMToken", ACDMTokenAddress))

    const ADMIN = await ACDMToken.ADMIN()
    await ACDMToken.connect(TokenOwner).grantRole(ADMIN, ACDMPlatformInterface.address)
    await XXXToken.connect(TokenOwner).grantRole(ADMIN, DAOVotingsInterface.address)
  });

  afterEach(async function() {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
            blockNumber: 6991226
          },
        },
      ],
    });
  })

  async function passDurationTime() {
    await ethers.provider.send("evm_increaseTime", [259200]) // pass duration time
    await ethers.provider.send("evm_mine", [])
  }

  async function getLastBlockTime() {
    const blockNumAfter = await ethers.provider.getBlockNumber();
    const blockAfter = await ethers.provider.getBlock(blockNumAfter);
    return blockAfter.timestamp;
  }

  describe("Public getter functions", function() {
    it("Should return ACDMToken address", async function() {
      expect(await ACDMPlatformInterface.ACDMToken()).to.equal(ACDMTokenAddress)
    })

    it("Should return DAOAdress ", async function() {
      expect(await ACDMPlatformInterface.DAOAdress()).to.equal(DAOVotingsInterface.address)
    })
  })

  describe("register function", function() {
    it("User cant registered twice", async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      expect(ACDMPlatformInterface.register(ethers.constants.AddressZero)).to.be.revertedWith("You have registered already")
    })

    it("User can register once without referrer", async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      expect(await ACDMPlatformInterface.isRegistered(Admin.address)).to.equal(true)
      expect(await ACDMPlatformInterface.referred(Admin.address)).to.equal(ethers.constants.AddressZero)
    })

    it("User can register with referrer", async function() {
      await ACDMPlatformInterface.register(user1.address)
      expect(await ACDMPlatformInterface.referred(Admin.address)).to.equal(user1.address)
    })
  })

  describe("register function", function() {
    it("User cant registered twice", async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      expect(ACDMPlatformInterface.register(ethers.constants.AddressZero)).to.be.revertedWith("You have registered already")
    })

    it("User can register once without referrer", async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      expect(await ACDMPlatformInterface.isRegistered(Admin.address)).to.equal(true)
      expect(await ACDMPlatformInterface.referred(Admin.address)).to.equal(ethers.constants.AddressZero)
    })

    it("User can not set himself as referrer", async function() {
      expect(ACDMPlatformInterface.register(Admin.address)).to.be.revertedWith("You can not set yourself as referrer")
    })

    it("User can register with referrer", async function() {
      await ACDMPlatformInterface.register(user1.address)
      expect(await ACDMPlatformInterface.referred(Admin.address)).to.equal(user1.address)
    })
  })

  describe("startSaleRound function", function() {
    beforeEach(async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      await ACDMPlatformInterface.connect(user1).register(ethers.constants.AddressZero)
    })

    it("Round status must not be onSale", async function() {
      await ACDMPlatformInterface.startSaleRound()
      expect(ACDMPlatformInterface.startSaleRound()).to.be.revertedWith("Round is already 'onSale'")
    })

    it("Current time must be later then nextRoundStart", async function() {
      await ACDMPlatformInterface.startSaleRound()
      expect(ACDMPlatformInterface.startTradeRound()).to.be.revertedWith("Round time did not pass")
    })

    it("User can start Sale round", async function() {
      await ACDMPlatformInterface.connect(user1).startSaleRound()
      const info = await ACDMPlatformInterface.roundInfo()
      expect(info[3]).to.equal(1)
    })
  })

  describe("buyACDM function", function() {
    beforeEach(async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      await ACDMPlatformInterface.connect(user1).register(Admin.address)
      await ACDMPlatformInterface.connect(user2).register(user1.address)
    })

    it("Round status must be onSale", async function() {
      expect(ACDMPlatformInterface.buyACDMToken({value: ethers.utils.parseEther("1")})).to.be.revertedWith("Round status is not 'onSale'")
    })

    it("Buyer would get his ACDMTokens", async function() {
      await ACDMPlatformInterface.connect(user1).startSaleRound()
      await ACDMPlatformInterface.connect(user1).buyACDMToken({value: ethers.utils.parseEther("1")})
      expect(await ACDMToken.balanceOf(user1.address)).to.be.equal("100000")
    })
  })

  describe("startTradeRound function", function() {
    beforeEach(async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      await ACDMPlatformInterface.connect(user1).register(Admin.address)
      await ACDMPlatformInterface.connect(user2).register(user1.address)
    })

    it("Round must not be onTrade", async function() {
      await ACDMPlatformInterface.startTradeRound()
      expect(ACDMPlatformInterface.startTradeRound()).to.be.revertedWith("Round is already 'onTrade'")
    })

    it("Current time must be above nextRoundStart time", async function() {
      await ACDMPlatformInterface.connect(user1).startSaleRound()
      expect(ACDMPlatformInterface.startTradeRound()).to.be.revertedWith("Round time did not pass")
    })

    it("User can start Trade round and all remainder ACDMT on platform would be burn ", async function() {
      await ACDMPlatformInterface.startSaleRound()
      await passDurationTime()
      await ACDMPlatformInterface.startTradeRound()
      const info = await ACDMPlatformInterface.roundInfo()
      expect(info[3]).to.equal(2)
      expect(await ACDMToken.balanceOf(ACDMPlatformInterface.address)).to.be.equal("0")
    })
  })

  describe("addOrder function", function() {
    beforeEach(async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      await ACDMPlatformInterface.connect(user1).register(Admin.address)
      await ACDMPlatformInterface.connect(user2).register(user1.address)
      await ACDMToken.connect(TokenOwner).mint(Admin.address, ethers.utils.parseEther("1"))
      await ACDMToken.connect(TokenOwner).mint(user1.address, ethers.utils.parseEther("1"))
      await ACDMToken.connect(TokenOwner).mint(user2.address, ethers.utils.parseEther("1"))
    })

    it("Round status must be onTrade", async function() {
      await ACDMToken.approve(ACDMPlatformInterface.address, ethers.utils.parseEther("1"))
      expect(ACDMPlatformInterface.addOrder(ethers.utils.parseEther("1"), ethers.utils.parseEther("1"))).to.be.revertedWith("Round is not 'onTrade'")
    })

    it("User with ACDMT can add an order for ETH onTrade round", async function() {
      await ACDMPlatformInterface.connect(user1).startTradeRound()
      await ACDMToken.connect(user1).approve(ACDMPlatformInterface.address, ethers.utils.parseEther("1"))
      await ACDMPlatformInterface.connect(user1).addOrder(ethers.utils.parseEther("1"), ethers.utils.parseEther("1"))
      const order = await ACDMPlatformInterface.orders(1)
      expect(order[0]).to.be.equal(user1.address)
      expect(order[1]).to.be.equal(ethers.utils.parseEther("1"))
      expect(order[2]).to.be.equal(ethers.utils.parseEther("1"))
    })
  })


  describe("removeOrder function", function() {
    it("After adding order, seller can remove order before anyone redeem it", async function() {
      await ACDMToken.connect(TokenOwner).mint(Admin.address, ethers.utils.parseEther("1"))
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      await ACDMPlatformInterface.startTradeRound()
      await ACDMToken.approve(ACDMPlatformInterface.address, ethers.utils.parseEther("1"))
      await ACDMPlatformInterface.addOrder(ethers.utils.parseEther("1"), ethers.utils.parseEther("1"))

      const order = await ACDMPlatformInterface.orders(1)
      expect(order[0]).to.be.equal(Admin.address)
      expect(order[1]).to.be.equal(ethers.utils.parseEther("1"))
      expect(order[2]).to.be.equal(ethers.utils.parseEther("1"))

      await ACDMPlatformInterface.removeOrder()
      const orderAfter = await ACDMPlatformInterface.orders(1)
      expect(orderAfter[0]).to.be.equal(Admin.address)
      expect(orderAfter[1]).to.be.equal("0")
      expect(orderAfter[2]).to.be.equal("0")
    })
  })

  describe("redeemOrder function", function() {
    beforeEach(async function() {
      await ACDMPlatformInterface.register(ethers.constants.AddressZero)
      await ACDMPlatformInterface.connect(user1).register(Admin.address)
      await ACDMPlatformInterface.connect(user2).register(user1.address)

      await ACDMToken.connect(TokenOwner).mint(Admin.address, ethers.utils.parseEther("1"))
      await ACDMPlatformInterface.connect(user1).startTradeRound()

      await ACDMToken.approve(ACDMPlatformInterface.address, ethers.utils.parseEther("1"))
      await ACDMPlatformInterface.addOrder(ethers.utils.parseEther("1"), ethers.utils.parseEther("1"))
    })

    it("Round status must be onTrade", async function() {
      await passDurationTime()
      await ACDMPlatformInterface.connect(user1).startSaleRound()
      expect(ACDMPlatformInterface.redeemOrder(1, {value: ethers.utils.parseEther("1")})).to.be.revertedWith("Trade time is over")
    })

    it("Buyer can not pay overprice for order", async function() {
      expect(ACDMPlatformInterface.connect(user1).redeemOrder(1, {value: ethers.utils.parseEther("2")})).to.be.revertedWith("Seller dont have enough ACDM")
    })

    it("User can redeem order with enough ETH and get ACDMT", async function() {
      await ACDMPlatformInterface.connect(user1).redeemOrder(1, {value: ethers.utils.parseEther("0.5")})

      const order = await ACDMPlatformInterface.orders(1)
      expect(order[0]).to.be.equal(Admin.address)
      expect(order[1]).to.be.equal(ethers.utils.parseEther("0.5"))
      expect(order[2]).to.be.equal(ethers.utils.parseEther("0.5"))

      expect(await ACDMToken.balanceOf(user1.address)).to.be.equal(`${ethers.utils.parseEther("0.5")}`)
    })
  })

  it("User must register first before take a part at Platform", async function() {
    expect(ACDMPlatformInterface.startSaleRound()).to.be.revertedWith("You must register before participate")
    expect(ACDMPlatformInterface.startTradeRound()).to.be.revertedWith("You must register before participate")
    expect(ACDMPlatformInterface.buyACDMToken({value: ethers.utils.parseEther("1")})).to.be.revertedWith("You must register before participate")
    expect(ACDMPlatformInterface.addOrder(ethers.utils.parseEther("1"), ethers.utils.parseEther("1"))).to.be.revertedWith("You must register before participate")
    expect(ACDMPlatformInterface.removeOrder()).to.be.revertedWith("You must register before participate")
    expect(ACDMPlatformInterface.redeemOrder(1, {value: ethers.utils.parseEther("1")})).to.be.revertedWith("You must register before participate")
  })
}