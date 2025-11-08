// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PayRouter {
    event Payment(bytes32 indexed sku, address indexed buyer, address indexed creator, uint256 amount, uint16 feeBps);

    address public immutable USDC;
    address public feeReceiver;
    uint16 public feeBps; // e.g., 250 = 2.5%

    constructor(address _usdc, address _feeReceiver, uint16 _feeBps) {
        USDC = _usdc;
        feeReceiver = _feeReceiver;
        feeBps = _feeBps;
    }

    function pay(bytes32 sku, address creator, uint256 amountUSDC) external {
        uint256 fee = (amountUSDC * feeBps) / 10_000;
        uint256 toCreator = amountUSDC - fee;

        require(IERC20(USDC).transferFrom(msg.sender, feeReceiver, fee), "fee xfer failed");
        require(IERC20(USDC).transferFrom(msg.sender, creator, toCreator), "xfer failed");

        emit Payment(sku, msg.sender, creator, amountUSDC, feeBps);
    }

    // Optional: Update fee receiver (only owner in production)
    function setFeeReceiver(address _feeReceiver) external {
        // In production, add onlyOwner modifier
        feeReceiver = _feeReceiver;
    }

    // Optional: Update fee basis points (only owner in production)
    function setFeeBps(uint16 _feeBps) external {
        // In production, add onlyOwner modifier and require _feeBps <= 1000 (10%)
        feeBps = _feeBps;
    }
}

