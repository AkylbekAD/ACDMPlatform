//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

/// @title Staking 
/// @author AkylbekAD
/// @notice Get votes to ACDMPlatform by staking LP tokens(XXXToken/ETH) here
/// @dev CHANGER role gives to ACDMPlatform and Deployer

import "./interfaces/IERC20.sol";
import "./interfaces/IUniswapV2.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Staking is AccessControl {

    struct Provider {
        uint256 stakedTokens;
        uint256 claimTime;
        uint256 unstakeTime;
    }

    uint256 public percentDecimals = 3;
    uint256 public rewardPercent = 3000;
    uint256 public claimTime = 7 days;
    uint256 public unstakeTime = 7 days;
    address public XXXTokenAddress;
    address public LPTokenAddress;
    address public DAOVotingsAddress;
    bytes32 public constant CHANGER = keccak256("CHANGER");
    bytes32 public constant DAO = keccak256("DAO");
    bytes32 public constant ADMIN = keccak256("ADMIN");

    mapping (address => Provider) public stakingProviders;

    event Staked(address depositor, uint256 amount);
    event Claimed(address depositor, uint256 reward);
    event Unstaked(address depositor, uint256 amount);

    constructor (address _XXXTokenAddress, address _LPTokenAddress) {
        XXXTokenAddress = _XXXTokenAddress;
        LPTokenAddress = _LPTokenAddress;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN, msg.sender);
        _setupRole(CHANGER, msg.sender);
    }

    modifier isChanger () {
        require(hasRole(CHANGER, msg.sender), "You dont have rights to change it");
        _;
    }

    modifier isDAO () {
        require(hasRole(DAO, msg.sender), "You dont have rights to change it");
        _;
    }
    
    function stake(uint256 amount) external {
        require(amount >= 100**percentDecimals, "You have to stake atleast 0.00001 of UNI-V2");
        IUniswapV2(LPTokenAddress).transferFrom(msg.sender, address(this), amount);
        stakingProviders[msg.sender].stakedTokens += amount;
        stakingProviders[msg.sender].claimTime = block.timestamp + claimTime;
        stakingProviders[msg.sender].unstakeTime = block.timestamp + unstakeTime;

        emit Staked(msg.sender, amount);
    }

    function claim() external {
        require(stakingProviders[msg.sender].claimTime <= block.timestamp, "Claim time have not pass yet");
        
        uint256 reward = (stakingProviders[msg.sender].stakedTokens * rewardPercent) / (100 * 10 ** percentDecimals);

        IERC20(XXXTokenAddress).mint(msg.sender, reward);

        emit Claimed(msg.sender, reward);
    }

    /// @notice Returns your staked LP tokens after Unstake and Debatig period had passed.
    function unstake() external {
        require(stakingProviders[msg.sender].unstakeTime <= block.timestamp, "Unstake time have not pass yet");

        uint256 LPTokens = stakingProviders[msg.sender].stakedTokens;
        stakingProviders[msg.sender].stakedTokens = 0;
        IUniswapV2(LPTokenAddress).transfer(msg.sender, LPTokens);

        emit Unstaked(msg.sender, LPTokens);
    }
    
    function setDAOAddress (address _DAOVotingsAddress) external isChanger {
        DAOVotingsAddress = _DAOVotingsAddress;
        _grantRole(DAO, _DAOVotingsAddress);
    }

    function setDepositDuration(address voter, uint256 depositDuration) external isDAO {
        stakingProviders[voter].unstakeTime = depositDuration;
    }

    function changeClaimTime (uint256 newTime) external isChanger {
        claimTime = newTime;
    }

    function changeUnstakeTime (uint256 newTime) external isChanger {
        unstakeTime = newTime;
    }

    function changeRewardPercent (uint256 newPercent) external isChanger{
        rewardPercent = newPercent;
    }

    function giveChangerRights (address newChanger) external {
        require(hasRole(ADMIN, msg.sender), "You dont have rights to change it");
        _grantRole(CHANGER, newChanger);
    }

    function revokeChangerRights (address newChanger) external {
        require(hasRole(ADMIN, msg.sender), "You dont have rights to change it");
        _revokeRole(CHANGER, newChanger);
    }
}