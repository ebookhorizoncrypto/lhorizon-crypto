import { ethers } from "ethers";
import dotenv from 'dotenv';
dotenv.config();

// Fix for process.argv in some environments, though Node usually handles it fine.

async function testConnection() {
    // 1. Get Contract Address from arguments or env
    const contractAddress = process.argv[2] || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base Mainnet USDC

    if (!contractAddress) {
        console.error("❌ Erreur: Aucune adresse de contrat fournie.");
        console.log("Usage: node scripts/verify-contract.js <CONTRACT_ADDRESS>");
        return;
    }

    console.log(`🔌 Connexion au réseau Base... (Contrat: ${contractAddress})`);

    // 2. Setup Provider
    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");

    // 3. ABI Definitions
    // HorizonRewardsBase uses 'owner()' from Ownable
    const contractAbi = [
        "function owner() view returns (address)",
        "function usdc() view returns (address)"
    ];
    const usdcAbi = ["function balanceOf(address) view returns (uint256)"];

    const contract = new ethers.Contract(contractAddress, contractAbi, provider);
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);

    try {
        // 4. Read Contract State
        const owner = await contract.owner();
        const linkedUSDC = await contract.usdc();
        const balance = await usdcContract.balanceOf(contractAddress);

        console.log("\n✅ Connexion Réussie !");
        console.log("-----------------------------------");
        console.log(`👑 Propriétaire (Backend) : ${owner}`);
        console.log(`💵 Jeton lié (USDC)      : ${linkedUSDC}`);
        console.log(`💰 Solde du contrat      : ${ethers.formatUnits(balance, 6)} USDC`);
        console.log("-----------------------------------");

        if (linkedUSDC.toLowerCase() !== usdcAddress.toLowerCase()) {
            console.warn("⚠️ ALERTE: L'adresse USDC du contrat ne semble pas être celle officielle de Base !");
        }

        if (balance == 0n) {
            console.log("⚠️ Le contrat est vide. Pensez à envoyer des USDC pour payer les récompenses.");
        } else {
            console.log("🟢 Le contrat est provisionné et prêt.");
        }

    } catch (error) {
        console.error("\n❌ Échec de la connexion :", error.message);
        console.error("Vérifiez que l'adresse du contrat est correcte et déployée sur Base.");
    }
}

testConnection();
