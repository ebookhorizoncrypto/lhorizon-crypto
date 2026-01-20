import { ethers } from 'ethers';

// Pack reward amounts in USDC (6 decimals)
const PACK_REWARDS = {
    'solo': 20 * 10 ** 6,   // 20 USDC
    'pro': 50 * 10 ** 6,    // 50 USDC
    'vip': 100 * 10 ** 6    // 100 USDC
};

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
        const { userAddress, emailHash, pack } = req.body;

        if (!userAddress || !emailHash) {
            return res.status(400).json({ error: 'Missing userAddress or emailHash' });
        }

        // 4. Determine reward amount based on pack
        // Default to 'solo' if pack not provided or invalid
        const packType = (pack && PACK_REWARDS[pack.toLowerCase()]) ? pack.toLowerCase() : 'solo';
        const rewardAmount = PACK_REWARDS[packType];

        console.log(`Processing claim: pack=${packType}, amount=${rewardAmount / 10 ** 6} USDC`);

        // 5. Load Private Key from Env
        const privateKey = process.env.STRIPE_REWARD_SIGNER_PRIVATE_KEY;
        if (!privateKey) {
            console.error("Missing STRIPE_REWARD_SIGNER_PRIVATE_KEY");
            return res.status(500).json({ error: 'Server Configuration Error' });
        }

        // 6. Initialize Wallet
        const wallet = new ethers.Wallet(privateKey);

        // 7. Get Contract Address
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || req.body.contractAddress;

        if (!contractAddress) {
            return res.status(400).json({ error: 'Missing contractAddress configuration' });
        }

        // 8. Calculate Solidity Packed Keccak256
        // Matches the smart contract: keccak256(abi.encodePacked(recipient, emailHash, amount, contractAddress))
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'bytes32', 'uint256', 'address'],
            [userAddress, emailHash, rewardAmount, contractAddress]
        );

        // 9. Sign the Message
        const messageBytes = ethers.getBytes(messageHash);
        const signature = await wallet.signMessage(messageBytes);

        // 10. Return Signature with amount info
        return res.status(200).json({
            signature,
            signer: wallet.address,
            amount: rewardAmount,
            amountReadable: `${rewardAmount / 10 ** 6} USDC`,
            pack: packType
        });

    } catch (error) {
        console.error('Sign Claim Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
