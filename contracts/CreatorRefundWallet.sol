// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CreatorRefundWallet
 * @notice Smart wallet for creators that enables automated refunds with configurable limits
 * @dev Allows creators to pre-authorize refunds up to certain thresholds without manual approval
 */
contract CreatorRefundWallet is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // USDC token address (set per chain)
    IERC20 public immutable usdc;

    // Refund settings
    struct RefundSettings {
        uint256 dailyRefundLimit;      // Max USD (6 decimals) that can be refunded per day
        uint256 perRefundLimit;        // Max USD (6 decimals) per individual refund
        uint256 conversationThreshold; // Number of refund requests before granting
        bool autoRefundsEnabled;       // Toggle for automated refunds
    }

    RefundSettings public settings;

    // Track refunds
    mapping(address => uint256) public lastRefundTime;
    mapping(address => uint256) public refundCountToday;
    uint256 public totalRefundedToday;
    uint256 public lastResetDay;

    // Authorized refund processors (backend services that can call processRefund)
    mapping(address => bool) public authorizedProcessors;

    // Events
    event RefundProcessed(
        address indexed user,
        uint256 amount,
        string transactionId,
        string refundType
    );
    event RefundSettingsUpdated(
        uint256 dailyLimit,
        uint256 perRefundLimit,
        uint256 conversationThreshold,
        bool autoEnabled
    );
    event ProcessorAuthorized(address indexed processor, bool authorized);
    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);

    /**
     * @notice Constructor
     * @param _usdc USDC token address
     * @param _owner Creator wallet address
     */
    constructor(address _usdc, address _owner) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_owner != address(0), "Invalid owner address");

        usdc = IERC20(_usdc);
        _transferOwnership(_owner);

        // Default settings
        settings = RefundSettings({
            dailyRefundLimit: 100 * 1e6,      // $100 per day
            perRefundLimit: 10 * 1e6,          // $10 per refund
            conversationThreshold: 3,           // 3 attempts before refund
            autoRefundsEnabled: true
        });

        lastResetDay = block.timestamp / 1 days;
    }

    /**
     * @notice Update refund settings (only creator can call)
     * @param _dailyLimit Daily refund limit in USDC (6 decimals)
     * @param _perRefundLimit Per-refund limit in USDC (6 decimals)
     * @param _conversationThreshold Number of conversations before refund
     * @param _autoEnabled Enable/disable automated refunds
     */
    function updateRefundSettings(
        uint256 _dailyLimit,
        uint256 _perRefundLimit,
        uint256 _conversationThreshold,
        bool _autoEnabled
    ) external onlyOwner {
        settings = RefundSettings({
            dailyRefundLimit: _dailyLimit,
            perRefundLimit: _perRefundLimit,
            conversationThreshold: _conversationThreshold,
            autoRefundsEnabled: _autoEnabled
        });

        emit RefundSettingsUpdated(_dailyLimit, _perRefundLimit, _conversationThreshold, _autoEnabled);
    }

    /**
     * @notice Authorize or deauthorize a refund processor
     * @param processor Address of the processor (backend service)
     * @param authorized True to authorize, false to revoke
     */
    function setAuthorizedProcessor(address processor, bool authorized) external onlyOwner {
        authorizedProcessors[processor] = authorized;
        emit ProcessorAuthorized(processor, authorized);
    }

    /**
     * @notice Process a refund automatically (called by authorized backend)
     * @param user User wallet address to refund
     * @param amount Amount in USDC (6 decimals)
     * @param transactionId Original transaction ID
     * @param refundType Type of refund (unlock, subscription)
     */
    function processRefund(
        address user,
        uint256 amount,
        string calldata transactionId,
        string calldata refundType
    ) external nonReentrant {
        require(authorizedProcessors[msg.sender], "Not authorized");
        require(settings.autoRefundsEnabled, "Auto refunds disabled");
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Amount must be positive");
        require(amount <= settings.perRefundLimit, "Exceeds per-refund limit");

        // Reset daily counters if needed
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastResetDay) {
            totalRefundedToday = 0;
            lastResetDay = currentDay;
        }

        // Check daily limit
        require(
            totalRefundedToday + amount <= settings.dailyRefundLimit,
            "Exceeds daily refund limit"
        );

        // Update counters
        totalRefundedToday += amount;
        lastRefundTime[user] = block.timestamp;

        // Transfer USDC to user
        require(usdc.transfer(user, amount), "USDC transfer failed");

        emit RefundProcessed(user, amount, transactionId, refundType);
    }

    /**
     * @notice Deposit USDC into the wallet (anyone can deposit)
     * @param amount Amount in USDC (6 decimals)
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit FundsDeposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw USDC from the wallet (only creator)
     * @param amount Amount in USDC (6 decimals)
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(usdc.transfer(owner(), amount), "Transfer failed");
        emit FundsWithdrawn(owner(), amount);
    }

    /**
     * @notice Withdraw all USDC from the wallet (only creator)
     */
    function withdrawAll() external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        require(usdc.transfer(owner(), balance), "Transfer failed");
        emit FundsWithdrawn(owner(), balance);
    }

    /**
     * @notice Get current balance
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get remaining daily refund limit
     */
    function getRemainingDailyLimit() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastResetDay) {
            return settings.dailyRefundLimit;
        }

        if (totalRefundedToday >= settings.dailyRefundLimit) {
            return 0;
        }

        return settings.dailyRefundLimit - totalRefundedToday;
    }

    /**
     * @notice Check if a refund can be processed
     * @param amount Amount to refund
     * @return canProcess True if refund can be processed
     * @return reason Reason if cannot process
     */
    function canProcessRefund(uint256 amount)
        external
        view
        returns (bool canProcess, string memory reason)
    {
        if (!settings.autoRefundsEnabled) {
            return (false, "Auto refunds disabled");
        }

        if (amount > settings.perRefundLimit) {
            return (false, "Exceeds per-refund limit");
        }

        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyRefunded = currentDay > lastResetDay ? 0 : totalRefundedToday;

        if (dailyRefunded + amount > settings.dailyRefundLimit) {
            return (false, "Exceeds daily limit");
        }

        uint256 balance = usdc.balanceOf(address(this));
        if (balance < amount) {
            return (false, "Insufficient balance");
        }

        return (true, "");
    }
}
