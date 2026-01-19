// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ProofOfLearningGasless
 * @dev Gasless Smart contract for L'Horizon Crypto reward distribution on Base
 * @notice Supports EIP-2771 Meta-Transactions + Backend Signature Verification
 */
contract ProofOfLearning is ERC2771Context, Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    // USDC on Base Mainnet
    IERC20 public immutable usdc;
    
    // Authorization Signer (Backend Wallet that approves claims)
    address public trustedSigner;
    
    // Reward amount: 20 USDC (6 decimals)
    uint256 public rewardAmount = 20 * 10**6;
    
    // Tracking claims - email hash => claimed
    mapping(bytes32 => bool) public hasClaimed;
    
    // Tracking wallet claims - address => claimed
    mapping(address => bool) public hasWalletClaimed;
    
    // Total stats
    uint256 public totalClaims;
    uint256 public totalDistributed;
    
    // Events
    event ClaimProcessed(address indexed recipient, bytes32 indexed emailHash, uint256 amount, uint256 timestamp);
    event SignerUpdated(address oldSigner, address newSigner);
    event ForwarderUpdated(address oldForwarder, address newForwarder);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    /**
     * @dev Constructor
     * @param _usdcAddress USDC token address on Base
     * @param _trustedForwarder The Trusted Forwarder address (e.g., from OpenZeppelin Defender or Biconomy)
     * @param _trustedSigner The backend address that signs valid claims
     */
    constructor(
        address _usdcAddress, 
        address _trustedForwarder,
        address _trustedSigner
    ) ERC2771Context(_trustedForwarder) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_trustedForwarder != address(0), "Invalid Forwarder address");
        require(_trustedSigner != address(0), "Invalid Signer address");
        
        usdc = IERC20(_usdcAddress);
        trustedSigner = _trustedSigner;
    }
    
    /**
     * @dev Override _msgSender to support Meta-Transactions
     */
    function _msgSender() internal view override(Context, ERC2771Context) returns (address sender) {
        return ERC2771Context._msgSender();
    }

    /**
     * @dev Override _msgData to support Meta-Transactions
     */
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    /**
     * @dev User claims reward (Gasless)
     * @param emailHash Keccak256 hash of the verified email
     * @param signature Backend signature verifying this user is allowed to claim
     * @notice This function is called by the Relayer, but _msgSender() is the User
     */
    function claimReward(
        bytes32 emailHash,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        address recipient = _msgSender();
        
        // 1. Checks
        require(recipient != address(0), "Invalid recipient");
        require(!hasClaimed[emailHash], "Email already claimed");
        require(!hasWalletClaimed[recipient], "Wallet already claimed");
        require(usdc.balanceOf(address(this)) >= rewardAmount, "Insufficient USDC balance");
        
    // 2. Verify Signature (Security against Fraud)
        // Message structure: keccak256(recipient + emailHash + contractAddress)
        // This prevents replay attacks on other contracts or for other users
        bytes32 messageHash = keccak256(abi.encodePacked(recipient, emailHash, address(this)));
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(messageHash);
        
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == trustedSigner, "Invalid Backend Signature");

        // 3. Effects
        hasClaimed[emailHash] = true;
        hasWalletClaimed[recipient] = true;
        totalClaims++;
        totalDistributed += rewardAmount;
        
        // 4. Interaction
        require(usdc.transfer(recipient, rewardAmount), "USDC transfer failed");
        
        emit ClaimProcessed(recipient, emailHash, rewardAmount, block.timestamp);
    }
    
    /**
     * @dev Update the Trusted Signer (Backend)
     */
    function setTrustedSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid address");
        emit SignerUpdated(trustedSigner, newSigner);
        trustedSigner = newSigner;
    }

    /**
     * @dev Emergency: Withdraw USDC
     */
    function withdrawUSDC(uint256 amount) external onlyOwner {
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        require(usdc.transfer(owner(), amount), "Withdraw failed");
        emit FundsWithdrawn(owner(), amount);
    }
    
    /**
     * @dev Emergency: Pause Contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
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
