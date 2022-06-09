//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

/// @title Votings smart-contract based on DAO
/// @author AkylbekAD
/// @notice You can participate in Votings depositing ExampleToken (EXT) 
/// @dev Could be redeployed with own ERC20 token and other parameters

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/IStaking.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IERC20.sol";
import "hardhat/console.sol";

/// @dev Throw this error if account without rights try to use chairman functions
error SenderDontHasRights(address sender);

/// @dev Throw this error if voting doesn`t get minimal quorum of votes
error MinimalVotingQuorum(uint256 votingIndex, uint256 votingQuorum);

contract DAOVotings is AccessControl {
    using Counters for Counters.Counter;
    Counters.Counter public Counter;

    /// @notice Person allowed to create Votings
    address public chairman;

    /// @notice Staking contract address for depositing
    address public stakingAddress;

    /// @notice Minimum amount of votes for Voting to be accomplished
    uint256 public minimumQuorum;

    /// @notice Minimum period of time for each Voting
    uint256 public minimumDuration = 3 days;

    /// @dev Bytes format for ADMIN role
    bytes32 public constant ADMIN = keccak256("ADMIN");

    /// @dev Bytes format for CHAIRMAN role
    bytes32 public constant CHAIRMAN = keccak256("CHAIRMAN");

    /// @dev Structure of each proposal Voting
    struct Voting {
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 debatingPeriodDuration;
        address contractAddress;
        bytes callData;
        bool votingFinished;
        mapping(address => uint256) votes;
    }

    /// @notice View Voting`s info by it`s index
    /// @dev Mapping stores all Votings info
    mapping(uint256 => Voting) public getProposal;

    event ProposalStarted(
        string description,
        uint256 votingIndex,
        uint256 debatingPeriodDuration,
        address contractAddress,
        bytes callData
    );
    event VoteGiven(
        address voter,
        uint256 votingIndex,
        bool decision,
        uint256 votingPower
    );
    event ProposalFinished(uint256 votingIndex, bool proposalCalled);

    /// @dev Modifier checks sender to be Chairman or Admin, otherwise reverts with error
    modifier isChairman() {
        if (!hasRole(ADMIN, msg.sender) && !hasRole(CHAIRMAN, msg.sender)) {
            revert SenderDontHasRights(msg.sender);
        }
        _;
    }

    /// @dev First chairman is deployer, must input token address and minimum quorum for votings
    constructor(address _stakingAddress, uint256 _minimumQuorum) {
        stakingAddress = _stakingAddress;
        minimumQuorum = _minimumQuorum;
        chairman = msg.sender;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN, msg.sender);
        _setRoleAdmin(CHAIRMAN, ADMIN);
    }
    
    receive() external payable virtual {}

    /// @dev Chaiman or Admin can set a minimum Voting Quorum
    function setMinimumQuorum(uint256 amount) external isChairman {
        minimumQuorum = amount;
    }

    /// @notice Only chairman or admin can start new Votings with proposal
    /// @dev Creates new voting and emits ProposalStarted event
    /// @param duration value cant be less then minimumDuration value
    /// @param contractAddress is address of contract callData on which should be called
    /// @param callData is hash which be decoded to abi and parametres to be called at contract
    function addProposal(
        string memory description,
        uint256 duration,
        address contractAddress,
        bytes memory callData
    ) public isChairman {
        Counter.increment();
        uint256 index = Counter.current();

        getProposal[index].description = description;
        getProposal[index].callData = callData;
        getProposal[index].contractAddress = contractAddress;

        if (duration < minimumDuration) {
            getProposal[index].debatingPeriodDuration =
                block.timestamp +
                minimumDuration;
        } else {
            getProposal[index].debatingPeriodDuration =
                block.timestamp +
                duration;
        }

        emit ProposalStarted(
            description,
            index,
            getProposal[index].debatingPeriodDuration,
            contractAddress,
            callData
        );
    }

    /// @notice Make your decision 'true' to vote for or 'false' to vote against with deposoted tokens
    /// @dev Voters can vote only once at each voting
    /// @param votesAmount is amount of deposited tokens at Staking
    /// @param decision must be 'true' or 'false'
    function vote(
        uint256 votingIndex,
        uint256 votesAmount,
        bool decision
    ) external {
        require(
            block.timestamp < getProposal[votingIndex].debatingPeriodDuration,
            "Voting have been ended"
        );
        uint256 deposit = IStaking(stakingAddress)
            .stakingProviders(msg.sender)
            .stakedTokens;
        require(votesAmount <= deposit, "Not enough deposited tokens");
        require(
            getProposal[votingIndex].votes[msg.sender] == 0,
            "You have already voted"
        );

        if (decision) {
            getProposal[votingIndex].votesFor += votesAmount;
        } else {
            getProposal[votingIndex].votesAgainst += votesAmount;
        }

        if (
            IStaking(stakingAddress).stakingProviders(msg.sender).unstakeTime <
            getProposal[votingIndex].debatingPeriodDuration
        ) {
            IStaking(stakingAddress).setDepositDuration(
                msg.sender,
                getProposal[votingIndex].debatingPeriodDuration
            );
        }

        getProposal[votingIndex].votes[msg.sender] += votesAmount;

        emit VoteGiven(msg.sender, votingIndex, decision, votesAmount);
    }

    /// @notice Finish voting and do proposal call
    /// @dev Calls proposalCall function with voting parameters and emits ProposalCalled event
    function finishProposal(uint256 votingIndex) external {
        require(
            block.timestamp >= getProposal[votingIndex].debatingPeriodDuration,
            "Debating period didnt pass"
        );
        require(
            !getProposal[votingIndex].votingFinished,
            "Proposal voting was already finished or not accepted"
        );

        uint256 votingQuorum = getProposal[votingIndex].votesFor +
            getProposal[votingIndex].votesAgainst;

        if (votingQuorum < minimumQuorum) {
            getProposal[votingIndex].votingFinished = true;

            emit ProposalFinished(votingIndex, false);

            revert MinimalVotingQuorum(votingIndex, votingQuorum);
        }

        if (
            getProposal[votingIndex].votesFor >
            getProposal[votingIndex].votesAgainst
        ) {
            proposalCall(
                getProposal[votingIndex].contractAddress,
                getProposal[votingIndex].callData
            );

            emit ProposalFinished(votingIndex, true);
        }

        getProposal[votingIndex].votingFinished = true;
    }

    function startChairmanElection(address newChairman, uint256 duration)
        external
    {
        require(hasRole(ADMIN, msg.sender), "You are not an Admin");

        bytes memory callData = abi.encodeWithSignature(
            "changeChairman(address)",
            newChairman
        );
        addProposal(
            "Proposal for a new Chairman",
            duration,
            address(this),
            callData
        );
    }

    /// @notice Get last voting index or number of all created proposals
    function getLastIndex() external view returns (uint256) {
        return Counter.current();
    }

    /// @notice Get amount of votes made by account at Voting
    function getVotes(uint256 votingIndex, address voter)
        external
        view
        returns (uint256)
    {
        return getProposal[votingIndex].votes[voter];
    }

    /// @dev Function that called if proposal voting is astablished succesfull
    function proposalCall(address contractAddress, bytes memory callData)
        private
    {
        (bool success, ) = contractAddress.call(callData);
        require(success, "Error proposalcall");
    }

    /// @dev Can only be called throw addProposal function by voting
    function changeChairman(address newChairman) external {
        require(msg.sender == address(this), "Must called throw proposal");
        chairman = newChairman;
    }

    /// @dev Can only be called throw addProposal function by voting
    function increaseXXXprice() external {
        require(msg.sender == address(this), "Must called throw proposal");

        address WETH = 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6;
        address UNIV2 = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
        address XXXToken = 0x125281199964620d35d63886F492b79415926661;
        address[] memory path = new address[](2); 
        path[0] = WETH;
        path[1] = XXXToken;
        uint256[] memory amount = IUniswapV2Router02(UNIV2).swapExactETHForTokens{value: getBalance()}(0, path, address(this), block.timestamp + 120);

        IERC20(XXXToken).burn(address(this), amount[1]);
    }
    
    function getBalance() public view returns(uint256) {
        return address(this).balance;
    }
}
