//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

/// @title ACDMToken
/// @author AkylbekAD
/// @notice ACDMT is ERC20 you can get only on sale or trade at ACDMPlatform
/// @dev Could be redeployed with own ERC20 token and other parameters

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ACDMToken is ERC20, AccessControl {

    /// @dev Bytes format for ADMIN, MINTER, BURNER role
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor() ERC20("ACDMToken", "ACDMT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _setRoleAdmin(MINTER_ROLE, ADMIN);
        _setRoleAdmin(BURNER_ROLE, ADMIN);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external onlyRole(ADMIN) {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyRole(ADMIN) {
        _burn(account, amount);
    }
}