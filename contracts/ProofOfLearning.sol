// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// NOUVEL IMPORT NÉCESSAIRE EN V5 :
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract ProofOfLearning is ERC2771Context {
    using ECDSA for bytes32;

    address public trustedSigner; 
    IERC20 public usdc;           

    mapping(bytes32 => bool) public claimedEmails;

    constructor(address _trustedForwarder, address _usdcAddress, address _trustedSigner) 
        ERC2771Context(_trustedForwarder) 
    {
        usdc = IERC20(_usdcAddress);
        trustedSigner = _trustedSigner;
    }

    function claimReward(bytes32 emailHash, bytes memory signature) public {
        require(!claimedEmails[emailHash], "Deja reclame");
        
        // Use _msgSender() for GSN/Meta-Tx compatibility
        address recipient = _msgSender();

        bytes32 messageHash = keccak256(abi.encodePacked(recipient, emailHash, address(this)));
        require(_verifySignature(messageHash, signature), "Signature invalide");

        claimedEmails[emailHash] = true;
        require(usdc.transfer(recipient, 20 * 10**6), "Echec transfert USDC");
    }

    function _verifySignature(bytes32 hash, bytes memory signature) internal view returns (bool) {
        // EN V5, ON UTILISE MessageHashUtils POUR LE PRÉFIXE ETHEREUM
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(hash);
        return ECDSA.recover(ethSignedMessageHash, signature) == trustedSigner;
    }

    function withdrawUSDC(uint256 amount) public {
        require(msg.sender == trustedSigner, "Non autorise");
        usdc.transfer(msg.sender, amount);
    }
}
