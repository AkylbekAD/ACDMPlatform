import hre from 'hardhat';
const ethers = hre.ethers;

const Staking = "0xE189b83A668E41231af9753705748261018AC59c"

async function main() {
    const [owner] = await ethers.getSigners()

    const DAOVotings = await ethers.getContractFactory('DAOVotings', owner)
    const DAO = await DAOVotings.deploy(Staking, ethers.utils.parseEther("1"))
    await DAO.deployed()
    console.log(DAO.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });