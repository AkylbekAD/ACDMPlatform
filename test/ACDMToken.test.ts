import chai from "chai"
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { solidity } from "ethereum-waffle"

chai.use(solidity);

export default function() {
  let ACDMToken;
  let ACDMTokenInterface: Contract;
  let owner: SignerWithAddress;
  let acc1: SignerWithAddress;
  let acc2: SignerWithAddress;
  let zeroAddress = "0x0000000000000000000000000000000000000000";
  let ADMIN = "0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42"
  let BURNER_ROLE = "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848"
  let MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"

  beforeEach(async function () {
      ACDMToken = await ethers.getContractFactory("ACDMToken");
      [owner, acc1, acc2] = await ethers.getSigners()    
      ACDMTokenInterface = await ACDMToken.deploy();
      await ACDMTokenInterface.deployed()
      await ACDMTokenInterface.connect(owner).mint(owner.address,1000000000)
  });

  describe("Getter public functions", function () {
    it("Should return name of token from 'name' getter function", async function () {
      expect (await ACDMTokenInterface.name()).to.equal("ACDMToken")
    })

    it("Should return 'true' if deployer has role 'ADMIN'", async function () {
      expect (await ACDMTokenInterface.hasRole(ADMIN, owner.address)).to.equal(true)
    })

    it("Should return 'true' if deployer has role 'BURNER_ROLE'", async function () {
      expect (await ACDMTokenInterface.hasRole(BURNER_ROLE, owner.address)).to.equal(true)
    })

    it("Should return 'true' if deployer has role 'MINTER_ROLE'", async function () {
      expect (await ACDMTokenInterface.hasRole(MINTER_ROLE, owner.address)).to.equal(true)
    })

    it("Should return symbol of token from 'symbol' getter function", async function () {
      expect (await ACDMTokenInterface.symbol()).to.equal("ACDMT")
    })

    it("Should return totalSupply of token from 'totalSupply' getter function", async function () {
      let result = await ACDMTokenInterface.totalSupply()
      result = ethers.utils.formatUnits(result, 0)
      expect(result).to.equal("1000000000")
    })

    it("Should return decimals of token from 'decimals' getter function", async function () {
      let result = await ACDMTokenInterface.decimals()
      result = ethers.utils.formatUnits(result, 0)
      expect(result).to.equal("6")
    })
  })

  describe("burn function", function() {
    it("ADMIN can burn tokens on certain address and total supply would decrease", async function () {
      await expect(ACDMTokenInterface.connect(owner).burn(owner.address, 1000000000)).to
        .emit(ACDMTokenInterface, "Transfer").withArgs(owner.address, zeroAddress, "1000000000")

      let result = await ACDMTokenInterface.totalSupply()
      result = ethers.utils.formatUnits(result, 0)
      expect(result).to.equal("0")
    })

    it("Only ADMIN could burn tokens", async function () {
      expect(ACDMTokenInterface.connect(acc1).burn(acc1.address,1000000000)).to.be.reverted
    })
  })

  describe("mint function", function() {
    it("ADMIN can mint new tokens and increase total supply of tokens", async function () {
      await expect(await ACDMTokenInterface.connect(owner).mint(owner.address,1000000000)).to
        .emit(ACDMTokenInterface, "Transfer").withArgs(zeroAddress, owner.address, "1000000000")

      let result = await ACDMTokenInterface.totalSupply()
      result = ethers.utils.formatUnits(result, 0)
      expect(result).to.equal("2000000000")
    })

    it("Only ADMIN could mint tokens", async function () {
      expect(ACDMTokenInterface.connect(acc1).mint(acc1.address,1000000000)).to.be.reverted
    })
  }) 

  describe("transferFrom function", function() {
    it("Anyone can transferFrom avaliable tokens from one address to another", async function () {
      await ACDMTokenInterface.connect(owner).approve(acc1.address, 1000000000)
      const transferFrom = await ACDMTokenInterface.connect(acc1).transferFrom(owner.address,acc1.address,1000000000)
      await transferFrom.wait();
      expect(transferFrom).to.emit(ACDMTokenInterface, "Transfer").withArgs(owner.address, acc1.address, "1000000000")
      
      let result = await ACDMTokenInterface.balanceOf(acc1.address)
      result = ethers.utils.formatUnits(result, 0)
      expect(result).to.equal("1000000000")
    })

    it("Revert if amount of tokens bigger then avaliable", async function () {
      ACDMTokenInterface.connect(owner).transfer(acc1.address, 1000000000)
      await expect(ACDMTokenInterface.connect(acc1).transferFrom(owner.address,acc1.address, 10000000000)).to.be.revertedWith("ERC20: insufficient allowance")
    })
  })

  describe("transfer function", function() {
    it("Anyone can transfer tokens from his address to another", async function () {
      await ACDMTokenInterface.connect(owner).transfer(acc1.address, 100000000)
      const transfer = await ACDMTokenInterface.connect(owner).transfer(acc2.address,100000000)
      await transfer.wait();
      expect(transfer).to.emit(ACDMTokenInterface, "Transfer").withArgs(owner.address, acc2.address, "100000000")

      let result = await ACDMTokenInterface.balanceOf(acc2.address)
      result = ethers.utils.formatUnits(result, 0)
      expect(result).to.equal("100000000")
    })

    it("Revert if amount of tokens is bigger then avaliable on balance", async function () { 
      await expect(ACDMTokenInterface.connect(acc1).transfer(acc1.address,1000000000)).to.be.revertedWith("ERC20: transfer amount exceeds balance")
    })
  })

  describe("approve function", function() {
    it("Anyone can set amount of tokens which it has to transfer from his address to another", async function () {
      await ACDMTokenInterface.transfer(acc1.address,100000000)
      const approve = await ACDMTokenInterface.connect(acc1).approve(acc2.address,100000000)
      await approve.wait();
      expect(approve).to.emit(ACDMTokenInterface, "Approval").withArgs(acc1.address, acc2.address, "100000000")

      let result = await ACDMTokenInterface.allowance(acc1.address,acc2.address)
      result = ethers.utils.formatUnits(result, 0)
      expect(result).to.equal("100000000")
    })

    it("Revert if amount of tokens bigger then account has on his balance", async function () {
      expect(ACDMTokenInterface.connect(acc1).approve(acc2.address,100000000)).to.be.revertedWith("Not enough tokens to approve")
    })
  })
}