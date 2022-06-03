import hre from 'hardhat';
const ethers = hre.ethers;

const DAOVotingsAddress = "0xdCD31f0E3bA186e6B50B8049D3B52BEb0aaDEd1C"
const ACDMTokenAddress = "0x2d8ecB8Dd7a70E49f70F5224AF7573078Ec20052"

async function main() {
    const [owner] = await ethers.getSigners()

    const ACDMPlatform = await ethers.getContractFactory('ACDMPlatform', owner)
    const platform = await ACDMPlatform.deploy(DAOVotingsAddress, ACDMTokenAddress, 60*60*24*3)
    await platform.deployed()
    console.log(platform.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });