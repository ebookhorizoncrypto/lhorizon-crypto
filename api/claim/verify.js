/**
 * L'Horizon Crypto - Claim Verification API
 * Vercel Serverless Function
 * 
 * POST /api/claim/verify
 * Body: { email: string, keys: string[] }
 */

import crypto from 'crypto';

// Get secret keys from environment
const getSecretKeys = () => {
    const keys = process.env.SECRET_12_KEYS || '';
    return keys.split(',').map(k => k.toLowerCase().trim()).filter(Boolean);
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, keys } = req.body;

    // Validate input
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Email invalide' });
    }

    if (!keys || !Array.isArray(keys) || keys.length !== 12) {
        return res.status(400).json({ error: '12 clés requises' });
    }

    const secretKeys = getSecretKeys();

    if (secretKeys.length !== 12) {
        console.error('SECRET_12_KEYS not properly configured');
        return res.status(500).json({ error: 'Configuration serveur incorrecte' });
    }

    // Verify keys (case insensitive, trimmed)
    const normalizedUserKeys = keys.map(k => k.toLowerCase().trim());
    const allCorrect = secretKeys.every((key, index) => normalizedUserKeys[index] === key);

    // Notify Discord of attempt
    if (process.env.DISCORD_WEBHOOK_URL) {
        const maskedEmail = email.charAt(0) + '***@' + email.split('@')[1];
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: allCorrect ? '✅ Clés Vérifiées !' : '❌ Tentative Échouée',
                    color: allCorrect ? 0x00FF88 : 0xFF4757,
                    fields: [
                        { name: '📧 Email', value: maskedEmail, inline: true },
                        { name: '🔑 Résultat', value: allCorrect ? 'Succès' : 'Échec', inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }]
            })
        }).catch(() => { });
    }

    if (!allCorrect) {
        return res.status(400).json({
            error: 'Clés incorrectes. Vérifiez chaque mot-clé dans l\'ordre des chapitres.',
            success: false
        });
    }

    // Generate claim token (valid for 15 minutes)
    const claimToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

    // In production, store this in a database (Vercel KV, Upstash Redis, etc.)
    // For now, we'll encode it in the token itself (signed)
    const tokenData = JSON.stringify({ email: email.toLowerCase(), expiresAt });
    const signature = crypto
        .createHmac('sha256', process.env.ADMIN_API_KEY || 'fallback-secret')
        .update(tokenData)
        .digest('hex');

    const signedToken = Buffer.from(`${tokenData}|${signature}`).toString('base64');

    return res.status(200).json({
        success: true,
        claimToken: signedToken,
        message: 'Clés vérifiées ! Connectez votre wallet pour recevoir votre récompense.'
    });
}
