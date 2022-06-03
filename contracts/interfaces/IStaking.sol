// SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.4;

/**
 * @dev Interface of the Staking.
 */
interface IStaking {

    struct Provider {
        uint256 stakedTokens;
        uint256 claimTime;
        uint256 unstakeTime;
    }

    /// @dev Returns provider info (see 'Provider' struct)
    function stakingProviders(address) external view returns (Provider memory);

    /// @dev DAO can change 'unstake' time for user if 'depositDuration' is longer
    function setDepositDuration(address voter, uint256 depositDuration) external;
}