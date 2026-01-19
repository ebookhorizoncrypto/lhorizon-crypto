import { ethers } from 'ethers';

// Helper to load env for local development testing (if needed)
// import 'dotenv/config'; 

// Vercel Serverless Function Handler
export default async function handler(req, res) {
    // 1. CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. Only Allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 3. Parse Body
        const { userAddress, emailHash } = req.body;

        if (!userAddress || !emailHash) {
            return res.status(400).json({ error: 'Missing userAddress or emailHash' });
        }

        // 4. Load Private Key from Env
        const privateKey = process.env.STRIPE_REWARD_SIGNER_PRIVATE_KEY;
        if (!privateKey) {
            console.error("Missing STRIPE_REWARD_SIGNER_PRIVATE_KEY");
            return res.status(500).json({ error: 'Server Configuration Error' });
        }

        // 5. Initialize Wallet
        const wallet = new ethers.Wallet(privateKey);

        // 6. Calculate Solidity Packed Keccak256
        // Matches the smart contract: keccak256(abi.encodePacked(recipient, emailHash, contractAddress))
        // NOTE: We need the contract address here. 
        // For security, it's best to verify the CONTRACT ADDRESS too, or hardcode it env.
        // Assuming we pass it or use an env variable. 
        // For this implementation, I will use an ENV variable or receive it.
        // However, the contract verifies: keccak256(abi.encodePacked(recipient, emailHash, address(this)))
        // So the signer MUST sign the exact same data including the deployed contract address.
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || req.body.contractAddress;

        if (!contractAddress) {
            return res.status(400).json({ error: 'Missing contractAddress configuration' });
        }

        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'bytes32', 'address'],
            [userAddress, emailHash, contractAddress]
        );

        // 7. Sign the Message
        // In Solidity: ECDSA.toEthSignedMessageHash(...) is automatically applied by wallet.signMessage
        // when passed a byte array. However, wallet.signMessage(string) treats it as string.
        // We must pass the binary data of the hash.
        const messageBytes = ethers.getBytes(messageHash);
        const signature = await wallet.signMessage(messageBytes);

        // 8. Return Signature
        return res.status(200).json({
            signature,
            signer: wallet.address
        });

    } catch (error) {
        console.error('Sign Claim Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
