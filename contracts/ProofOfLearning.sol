// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ProofOfLearning
 * @dev Smart contract for L'Horizon Crypto reward distribution on Base
 * @notice Distributes 20$ USDC rewards to verified learners
 */
contract ProofOfLearning is Ownable, Pausable, ReentrancyGuard {
    
    // USDC on Base Mainnet
    IERC20 public immutable usdc;
    
    // Reward amount: 20 USDC (6 decimals)
    uint256 public rewardAmount = 20 * 10**6;
    
    // Tracking claims - email hash => claimed
    mapping(bytes32 => bool) public hasClaimed;
    
    // Tracking wallet claims - address => claimed
    mapping(address => bool) public hasWalletClaimed;
    
    // Total claims made
    uint256 public totalClaims;
    
    // Total USDC distributed
    uint256 public totalDistributed;
    
    // Events
    event ClaimProcessed(
        address indexed recipient,
        bytes32 indexed emailHash,
        uint256 amount,
        uint256 timestamp
    );
    
    event RewardAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event FundsDeposited(address indexed depositor, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _usdcAddress USDC token address on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
     */
    constructor(address _usdcAddress) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(_usdcAddress);
    }
    
    /**
     * @dev Process a reward claim
     * @param recipient The wallet address to receive USDC
     * @param emailHash Keccak256 hash of the verified email
     * @notice Only owner can call (backend validates off-chain)
     */
    function processClaim(
        address recipient,
        bytes32 emailHash
    ) external onlyOwner nonReentrant whenNotPaused {
        require(recipient != address(0), "Invalid recipient");
        require(!hasClaimed[emailHash], "Email already claimed");
        require(!hasWalletClaimed[recipient], "Wallet already claimed");
        require(usdc.balanceOf(address(this)) >= rewardAmount, "Insufficient USDC balance");
        
        // Mark as claimed
        hasClaimed[emailHash] = true;
        hasWalletClaimed[recipient] = true;
        
        // Update stats
        totalClaims++;
        totalDistributed += rewardAmount;
        
        // Transfer USDC
        require(usdc.transfer(recipient, rewardAmount), "USDC transfer failed");
        
        emit ClaimProcessed(recipient, emailHash, rewardAmount, block.timestamp);
    }
    
    /**
     * @dev Batch process multiple claims
     * @param recipients Array of wallet addresses
     * @param emailHashes Array of email hashes
     */
    function batchProcessClaims(
        address[] calldata recipients,
        bytes32[] calldata emailHashes
    ) external onlyOwner nonReentrant whenNotPaused {
        require(recipients.length == emailHashes.length, "Array length mismatch");
        require(recipients.length <= 50, "Max 50 claims per batch");
        
        uint256 totalRequired = rewardAmount * recipients.length;
        require(usdc.balanceOf(address(this)) >= totalRequired, "Insufficient USDC balance");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (
                recipients[i] != address(0) &&
                !hasClaimed[emailHashes[i]] &&
                !hasWalletClaimed[recipients[i]]
            ) {
                hasClaimed[emailHashes[i]] = true;
                hasWalletClaimed[recipients[i]] = true;
                totalClaims++;
                totalDistributed += rewardAmount;
                
                require(usdc.transfer(recipients[i], rewardAmount), "USDC transfer failed");
                
                emit ClaimProcessed(recipients[i], emailHashes[i], rewardAmount, block.timestamp);
            }
        }
    }
    
    /**
     * @dev Check if an email has already claimed
     * @param email The email address to check
     */
    function hasEmailClaimed(string calldata email) external view returns (bool) {
        bytes32 emailHash = keccak256(abi.encodePacked(email));
        return hasClaimed[emailHash];
    }
    
    /**
     * @dev Update the reward amount
     * @param newAmount New reward amount in USDC (6 decimals)
     */
    function setRewardAmount(uint256 newAmount) external onlyOwner {
        require(newAmount > 0, "Amount must be > 0");
        uint256 oldAmount = rewardAmount;
        rewardAmount = newAmount;
        emit RewardAmountUpdated(oldAmount, newAmount);
    }
    
    /**
     * @dev Get contract USDC balance
     */
    function getUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
    
    /**
     * @dev Get number of remaining possible claims based on balance
     */
    function getRemainingClaimsCapacity() external view returns (uint256) {
        return usdc.balanceOf(address(this)) / rewardAmount;
    }
    
    /**
     * @dev Withdraw USDC from contract (emergency or end of campaign)
     * @param amount Amount to withdraw
     */
    function withdrawUSDC(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        require(usdc.transfer(owner(), amount), "Withdraw failed");
        emit FundsWithdrawn(owner(), amount);
    }
    
    /**
     * @dev Pause the contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Receive function to accept ETH deposits (for gas refunds if needed)
     */
    receive() external payable {}
    
    /**
     * @dev Withdraw ETH from contract
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner()).transfer(balance);
    }
}
