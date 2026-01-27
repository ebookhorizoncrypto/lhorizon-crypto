import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
    const { action } = req.query;

    // --- CONFIG ---
    // Support both old and new variable names
    const ADMIN_PASSWORD = process.env.ADMIN_KEY || process.env.ADMIN_API_KEY;

    // --- LOGIN ---
    if (req.method === 'POST' && action === 'login') {
        const { key } = req.body;
        if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'Server misconfiguration: No Admin Key' });

        if (key === ADMIN_PASSWORD) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    // --- AUTH MIDDLEWARE for other actions ---
    const apiKey = req.headers['x-admin-key'] || req.query.key;
    if (apiKey !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // --- STATS ---
        if (action === 'stats') {
            const { count: customerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
            const { count: claimCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).not('wallet_address', 'is', null);

            let contractBalance = "0";
            try {
                if (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) {
                    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
                    const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
                    const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
                    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);

                    const balance = await usdcContract.balanceOf(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
                    contractBalance = ethers.formatUnits(balance, 6);
                }
            } catch (err) {
                contractBalance = "Error";
            }

            return res.status(200).json({
                customers: customerCount || 0,
                claims: claimCount || 0,
                revenue: (customerCount || 0) * 99,
                contractBalance: contractBalance,
                contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "Non configuré"
            });
        }

        // --- CUSTOMERS ---
        if (action === 'customers') {
            const { data: customers, error } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            return res.status(200).json(customers);
        }

        return res.status(400).json({ error: 'Unknown action' });

    } catch (error) {
        console.error("Admin API Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
