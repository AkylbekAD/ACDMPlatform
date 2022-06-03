import hre from 'hardhat';
const ethers = hre.ethers;

async function main() {
    const [owner] = await ethers.getSigners()

    const ACDMToken = await ethers.getContractFactory('ACDMToken', owner)
    const acdmToken = await ACDMToken.deploy()
    await acdmToken.deployed()
    console.log(acdmToken.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });