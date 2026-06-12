// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VVVToken
 * @notice VVV Eco governance and staking token for Base Sepolia testnet
 */
contract VVVToken is ERC20, Ownable {
    constructor() ERC20("VVV Token", "VVV") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals()); // 1 billion
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
