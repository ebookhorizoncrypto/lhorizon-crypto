import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

// Init Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ABI for HorizonRewardsBase
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const CONTRACT_ABI = require('../utils/HorizonABI.json');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // Check Configuration
    if (!process.env.STRIPE_REWARD_SIGNER_PRIVATE_KEY) {
        console.error("❌ Missing STRIPE_REWARD_SIGNER_PRIVATE_KEY");
        return res.status(500).json({ error: "Server Configuration Error: Missing Wallet Key" });
    }
    if (!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) {
        console.error("❌ Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
        return res.status(500).json({ error: "Server Configuration Error: Missing Contract Address" });
    }

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
            pack = 'solo'; // Admin Test Mode (20$)
        } else {
            return res.status(404).json({ error: "Client non trouvé." });
        }

        // 2. Determine Amount (USDC has 6 decimals)
        // using BigInt for ethers v6
        let amount = 20n * 1000000n; // Default Solo
        if (pack === 'pro') amount = 50n * 1000000n;
        if (pack === 'vip') amount = 100n * 1000000n;

        // 3. Setup Provider & Wallet (v6 Syntax)
        const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
        const wallet = new ethers.Wallet(process.env.STRIPE_REWARD_SIGNER_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        console.log(`🚀 Distributing Reward: ${email} -> ${ethers.formatUnits(amount, 6)} USDC to ${walletAddress}`);

        // 4. Hash Email (Privacy) - v6 Syntax
        const emailHash = ethers.id(email);

        // 5. Send Transaction
        // Manually set gas limit to be safe
        const tx = await contract.distributeReward(walletAddress, amount, emailHash);

        console.log(`✅ Transaction sent: ${tx.hash}`);

        res.status(200).json({
            success: true,
            txHash: tx.hash,
            amount: ethers.formatUnits(amount, 6)
        });

    } catch (error) {
        console.error("Distribute Error:", error);
        res.status(500).json({ error: error.shortMessage || error.message || "Unknown Error" });
    }
}
