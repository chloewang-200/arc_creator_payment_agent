// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing on Arc Testnet
 * @dev Has 6 decimals like real USDC
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {
        // Mint 1 million USDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10**DECIMALS);
    }

    /**
     * @notice Override decimals to match real USDC (6 decimals)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Mint tokens for testing (only owner)
     * @param to Address to mint to
     * @param amount Amount to mint (in USDC, will be multiplied by 10^6)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount * 10**DECIMALS);
    }

    /**
     * @notice Faucet function - anyone can mint 100 USDC for testing
     */
    function faucet() external {
        require(balanceOf(msg.sender) < 1000 * 10**DECIMALS, "You already have enough USDC");
        _mint(msg.sender, 100 * 10**DECIMALS); // 100 USDC
    }
}
