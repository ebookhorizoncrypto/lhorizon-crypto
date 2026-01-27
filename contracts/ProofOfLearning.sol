// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HorizonRewardsBase is Ownable {
    
    IERC20 public usdc;
    // On utilise bytes32 pour le hash de l'email (Confidentialité + Gaz)
    mapping(bytes32 => bool) public claimedHashes; 

    event RewardDistributed(address indexed recipient, uint256 amount, bytes32 indexed emailHash);

    constructor(address _usdcAddress) Ownable(msg.sender) {
        usdc = IERC20(_usdcAddress);
    }

    // Le backend calcule le hash de l'email avant d'appeler cette fonction
    function distributeReward(address recipient, uint256 amount, bytes32 emailHash) external onlyOwner {
        require(!claimedHashes[emailHash], "Deja reclame");
        require(amount > 0, "Montant invalide");
        
        uint256 balance = usdc.balanceOf(address(this));
        require(balance >= amount, "Contrat vide : contactez le support");

        claimedHashes[emailHash] = true;
        
        // Transfert direct
        require(usdc.transfer(recipient, amount), "Echec transfert");

        emit RewardDistributed(recipient, amount, emailHash);
    }

    function withdrawUSDC(uint256 amount) external onlyOwner {
        usdc.transfer(msg.sender, amount);
    }

    function setUSDC(address _usdc) external onlyOwner {
        usdc = IERC20(_usdc);
    }
}
