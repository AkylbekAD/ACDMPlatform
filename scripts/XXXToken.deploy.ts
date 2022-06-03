import hre from 'hardhat';
const ethers = hre.ethers;

async function main() {
    const [owner] = await ethers.getSigners()

    const XXXToken = await ethers.getContractFactory('XXXToken', owner)
    const xxxToken = await XXXToken.deploy()
    await xxxToken.deployed()
    console.log(xxxToken.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });