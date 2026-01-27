/**
 * L'Horizon Crypto - Admin Stats API
 * Vercel Serverless Function
 *
 * GET /api/admin/stats
 * Headers: Authorization: Bearer <ADMIN_API_KEY>
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'placeholder'
);

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
        // Get today's date boundaries (UTC)
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setUTCHours(23, 59, 59, 999);

        // Fetch all customers
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('amount_paid, created_at, claimed, claim_tx_hash');

        if (customersError) {
            console.error('Supabase error:', customersError);
            throw customersError;
        }

        // Calculate stats
        const totalSales = customers?.length || 0;
        const totalRevenue = customers?.reduce((sum, c) => sum + (c.amount_paid || 0), 0) || 0;
        const totalClaims = customers?.filter(c => c.claimed || c.claim_tx_hash).length || 0;
        const claimRate = totalSales > 0 ? ((totalClaims / totalSales) * 100).toFixed(1) + '%' : '0%';

        // Today's stats
        const todayCustomers = customers?.filter(c => {
            const createdAt = new Date(c.created_at);
            return createdAt >= todayStart && createdAt <= todayEnd;
        }) || [];

        const todaySales = todayCustomers.length;
        const todayRevenue = todayCustomers.reduce((sum, c) => sum + (c.amount_paid || 0), 0);

        const stats = {
            totalSales,
            totalRevenue,
            totalClaims,
            claimRate,
            todaySales,
            todayRevenue,
            lastUpdated: new Date().toISOString()
        };

        return res.status(200).json(stats);

    } catch (error) {
        console.error('Stats API Error:', error);
        return res.status(500).json({
            error: 'Erreur serveur',
            details: error.message
        });
    }
}
