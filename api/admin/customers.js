/**
 * L'Horizon Crypto - Admin Customers API
 * Vercel Serverless Function
 *
 * GET /api/admin/customers
 * Headers: Authorization: Bearer <ADMIN_API_KEY>
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'placeholder'
);

function shortenAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify admin API key
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!authHeader || !expectedKey) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    const providedKey = authHeader.replace('Bearer ', '');

    // Constant-time comparison to prevent timing attacks
    if (providedKey.length !== expectedKey.length ||
        !crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey))) {
        return res.status(401).json({ error: 'Clé API invalide' });
    }

    try {
        // Fetch customers from Supabase, ordered by most recent first
        const { data: customers, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        // Transform data for frontend
        const transformedCustomers = (customers || []).map(c => ({
            email: c.email,
            pack: (c.access_level || 'solo').toLowerCase(),
            amount: c.amount_paid || 0,
            purchasedAt: c.created_at,
            claimed: !!(c.claimed || c.claim_tx_hash),
            claimWallet: c.claim_wallet ? shortenAddress(c.claim_wallet) : null,
            claimedAt: c.claimed_at || null,
            claimTxHash: c.claim_tx_hash || null,
            discordId: c.discord_id || null,
            expiresAt: c.expires_at || null
        }));

        return res.status(200).json(transformedCustomers);

    } catch (error) {
        console.error('Customers API Error:', error);
        return res.status(500).json({
            error: 'Erreur serveur',
            details: error.message
        });
    }
}
