/**
 * API Endpoint: Wallet Configuration
 * Returns public wallet configuration including project ID
 *
 * This allows using environment variables on Vercel
 * while keeping the frontend static
 */

export default function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Return wallet configuration
    // Project ID can be set via Vercel Environment Variables
    const config = {
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'ab69881fb47e7ca4ae5636c982bc6d34',
        metadata: {
            name: "L'Horizon Crypto",
            description: 'Guide Crypto Proof of Learning - Gagnez des USDC',
            url: process.env.SITE_URL || 'https://ebook-horizoncrypto.com',
            icons: [`${process.env.SITE_URL || 'https://ebook-horizoncrypto.com'}/assets/logo-horizon-crypto.png`]
        },
        networks: ['base', 'mainnet'],
        themeMode: 'dark'
    };

    // Cache for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json(config);
}
