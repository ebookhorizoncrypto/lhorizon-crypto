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
    
    // Reward amount is now dynamic, passed in the claim function
    // uint256 public rewardAmount = 20 * 10**6; // REMOVED
    
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
     * @param amount The reward amount in USDC (6 decimals)
     * @param signature Backend signature verifying this user is allowed to claim
     * @notice This function is called by the Relayer, but _msgSender() is the User
     */
    function claimReward(
        bytes32 emailHash,
        uint256 amount,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        address recipient = _msgSender();
        
        // 1. Checks
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(!hasClaimed[emailHash], "Email already claimed");
        require(!hasWalletClaimed[recipient], "Wallet already claimed");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient USDC balance");
        
        // 2. Verify Signature (Security against Fraud)
        // Message structure: keccak256(recipient + emailHash + amount + contractAddress)
        // This prevents replay attacks on other contracts or for other users
        bytes32 messageHash = keccak256(abi.encodePacked(recipient, emailHash, amount, address(this)));
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(messageHash);
        
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == trustedSigner, "Invalid Backend Signature");

        // 3. Effects
        hasClaimed[emailHash] = true;
        hasWalletClaimed[recipient] = true;
        totalClaims++;
        totalDistributed += amount;
        
        // 4. Interaction
        require(usdc.transfer(recipient, amount), "USDC transfer failed");
        
        emit ClaimProcessed(recipient, emailHash, amount, block.timestamp);
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

