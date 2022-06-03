//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

/// @title XXXToken
/// @author AkylbekAD
/// @notice You can add liquidity into pool XXXToken/ETH to get LP for ACDMPlatform
/// @dev There is only ADMIN role to mint and burn tokens

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract XXXToken is ERC20, AccessControl {

    /// @dev Bytes format for ADMIN, MINTER, BURNER role
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor() ERC20("XXXToken", "XXX") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _setRoleAdmin(MINTER_ROLE, ADMIN);
        _setRoleAdmin(BURNER_ROLE, ADMIN);

        _mint(msg.sender, 1000000000000000000000000000000);
    }

    function mint(address account, uint256 amount) external onlyRole(ADMIN) {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyRole(ADMIN) {
        _burn(account, amount);
    }
}