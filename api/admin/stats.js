/**
 * L'Horizon Crypto - Admin Stats API
 * Vercel Serverless Function
 * 
 * GET /api/admin/stats
 * Headers: Authorization: Bearer <ADMIN_API_KEY>
 */

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

    // In production, fetch from database (Vercel KV, Supabase, etc.)
    // For demo, return mock data
    const stats = {
        totalSales: 0,
        totalRevenue: 0,
        totalClaims: 0,
        todaySales: 0,
        todayRevenue: 0,
        claimRate: '0%',
        lastUpdated: new Date().toISOString()
    };

    // Note: In a real implementation, you would:
    // 1. Connect to your database (Supabase, PlanetScale, etc.)
    // 2. Query actual sales and claims data
    // 3. Return real statistics

    return res.status(200).json(stats);
}

// Import crypto for timing-safe comparison
import crypto from 'crypto';
