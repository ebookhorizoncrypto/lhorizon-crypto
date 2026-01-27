import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

// Init Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ABI for HorizonRewardsBase
const CONTRACT_ABI = [
    "function distributeReward(address recipient, uint256 amount, bytes32 emailHash) external"
];

const PRIVATE_KEY = process.env.STRIPE_REWARD_SIGNER_PRIVATE_KEY; // Using existing env var for Owner Key

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { email, walletAddress } = req.body;

    if (!email || !walletAddress) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        // 1. Verify Eligibility in DB
        const { data: customer, error: dbError } = await supabase
            .from('customers')
            .select('access_level, email')
            .eq('email', email)
            .single();

        let pack = 'solo';
        if (customer) {
            pack = customer.access_level.toLowerCase();
        } else if (email === 'adrien.orange@yahoo.fr') {
            pack = 'vip'; // Admin Bypass
        } else {
            return res.status(404).json({ error: "Client non trouvé." });
        }

        // 2. Determine Amount (USDC has 6 decimals)
        let amount = 20 * 1e6; // Default Solo
        if (pack === 'pro') amount = 50 * 1e6;
        if (pack === 'vip') amount = 100 * 1e6;

        console.log(`🚀 Distributing Reward: ${email} -> ${amount / 1e6} USDC to ${walletAddress}`);

        // 3. Connect to Blockchain (Backend pays gas)
        const provider = new ethers.providers.JsonRpcProvider("https://mainnet.base.org");
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        // 4. Hash Email (Privacy)
        const emailHash = ethers.utils.id(email);

        // 5. Send Transaction
        // We manually set gas limit to be safe, though estimation usually works
        const tx = await contract.distributeReward(walletAddress, amount, emailHash, {
            gasLimit: 100000
        });

        console.log(`✅ Transaction sent: ${tx.hash}`);

        // Wait for confirmation (optional, better for UX to return tx hash immediately)
        // await tx.wait();

        res.status(200).json({ success: true, txHash: tx.hash, amount: amount / 1e6 });

    } catch (error) {
        console.error("Distribute Error:", error);
        res.status(500).json({ error: error.reason || error.message });
    }
}
