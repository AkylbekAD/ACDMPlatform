import hre from 'hardhat';
const ethers = hre.ethers;

const XXXTokenAddress = "0x125281199964620d35d63886F492b79415926661"
const UNIV2Address = "0xda6F7786E2b62DdD7d1dD848902Cc49b68805e0a"

async function main() {
    const [owner] = await ethers.getSigners()

    const Staking = await ethers.getContractFactory('Staking', owner)
    const staking = await Staking.deploy(XXXTokenAddress, UNIV2Address)
    await staking.deployed()
    console.log(staking.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });