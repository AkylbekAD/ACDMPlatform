import { task } from "hardhat/config";

const XXXTokenAddress = "0x125281199964620d35d63886F492b79415926661"
const ACDMTokenAddress = "0x2d8ecB8Dd7a70E49f70F5224AF7573078Ec20052"
const UNIV2Address = "0xda6F7786E2b62DdD7d1dD848902Cc49b68805e0a"
const StakingAddress = "0xE189b83A668E41231af9753705748261018AC59c"
const DAOVotingsAddress = "0xdCD31f0E3bA186e6B50B8049D3B52BEb0aaDEd1C"
const ACDMPlatformAddress = "0xf229e602f6F7a55E84A74b407c9478F5C314DC5B"

task("grantAdmin", "Grant ADMIN role at ACDMToken to contract or account")
    .addParam("address", "new admin")
    .setAction(async (taskArgs, hre) => {
    let ACDMToken = await hre.ethers.getContractAt("ACDMToken", ACDMTokenAddress);
    const ADMIN = await ACDMToken.ADMIN();
    await ACDMToken.grantRole(ADMIN, taskArgs.address);
});

task("stake", "Stake tokens")
    .addParam("amount", "Amount of tokens to stake")
    .setAction(async (taskArgs, hre) => {
    let Staking = await hre.ethers.getContractAt("Staking", StakingAddress);
    await Staking.stake(taskArgs.amount);
});

task("claim", "Claim reward")
    .setAction(async (taskArgs, hre) => {
    let Staking = await hre.ethers.getContractAt("Staking", StakingAddress);
    await Staking.claim();
});

task("unstake", "Unstake tokens")
  .setAction(async (taskArgs, hre) => {
  let Staking = await hre.ethers.getContractAt("Staking", StakingAddress);
  await Staking.unstake();
});

task("register", "Register on ACDM platform")
    .addParam("address", "referrer's address")
    .setAction(async (taskArgs, hre) => {
    let acmd = await hre.ethers.getContractAt("ACDMPlatform", ACDMPlatformAddress);
    await acmd.register(taskArgs.address);
});

task("startSaleRound", "Start sale round on ACDM platform")
    .setAction(async (taskArgs, hre) => {
    let acmd = await hre.ethers.getContractAt("ACDMPlatform", ACDMPlatformAddress);
    await acmd.startSaleRound();
});

task("buyACDM", "Buy ACDM tokens on ACDM platform")
    .addParam("amount", "amount of tokens to buy")
    .setAction(async (taskArgs, hre) => {
    let acmd = await hre.ethers.getContractAt("ACDMPlatform", ACDMPlatformAddress);
    await acmd.buyACDM(taskArgs.amount);
});

task("startTradeRound", "Start trade round on ACDM platform")
    .setAction(async (taskArgs, hre) => {
    let acmd = await hre.ethers.getContractAt("ACDMPlatform", ACDMPlatformAddress);
    await acmd.startTradeRound();
});

task("addOrder", "Add order in trade round on ACDM platform")
    .addParam("amount", "amount of token")
    .addParam("price", "price for all amount")
    .setAction(async (taskArgs, hre) => {
    let acmd = await hre.ethers.getContractAt("ACDMPlatform", ACDMPlatformAddress);
    await acmd.addOrder(taskArgs.amount, taskArgs.price);
});

task("redeemOrder", "Redeem order in trade round on ACDM platform")
    .addParam("id", "order's id")
    .addParam("amount", "amount of token")
    .setAction(async (taskArgs, hre) => {
    let acmd = await hre.ethers.getContractAt("ACDMPlatform", ACDMPlatformAddress);
    await acmd.redeemOrder(taskArgs.id, taskArgs.amount);
});

task("addProposal", "Add DAO proposal voting")
    .addParam("desc", "Short description for proposal")
    .addParam("time", "Set debatig period time for proposal")
    .addParam("contract", "Contract address for proposal call")
    .addParam("call", "CallData in 'bytes' to call at contract")
    .setAction(async (taskArgs, hre) => {
        const DAOVotingsInterface = await hre.ethers.getContractAt("DAOVotings", DAOVotingsAddress)
        await DAOVotingsInterface.addProposal(taskArgs.desc, taskArgs.time, taskArgs.contract, taskArgs.call)
})

task("vote", "Vote at proposal voting with your votes amount or 'votingPower'")
    .addParam("id", "Id of proposal voting")
    .addParam("votes", "Amount of your deposited tokens or 'votingPower'")
    .addParam("bool", "Set 'true' if you support proposal or 'false' if you disagree with it")
    .setAction(async (taskArgs, hre) => {
        const DAOVotingsInterface = await hre.ethers.getContractAt("DAOVotings", DAOVotingsAddress)
        await DAOVotingsInterface.vote(taskArgs.id, taskArgs.votes, taskArgs.bool)
})

task("finishProposal", "Finish proposal voting and initialize callData if votes 'FOR' are more then 'AGAINST'")
    .addParam("id", "ID of proposal voting at contract you want to finish")
    .setAction(async (taskArgs, hre) => {
        const DAOVotingsInterface = await hre.ethers.getContractAt("DAOVotings", DAOVotingsAddress)
        await DAOVotingsInterface.finishProposal(taskArgs.id)
})