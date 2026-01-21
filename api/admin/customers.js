export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Mock customers
    const customers = [
        { email: "thomas.crypto@mgmail.com", pack: "vip", amount: 549, purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), claimed: true, claimWallet: "0x71C...92A1", claimedAt: new Date().toISOString(), claimTxHash: "0x1234" },
        { email: "julie.bertrand@outlook.fr", pack: "solo", amount: 99, purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), claimed: false },
        { email: "marc.invest@yahoo.com", pack: "pro", amount: 299, purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), claimed: true, claimWallet: "0xABC...DEF1", claimedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), claimTxHash: "0x5678" },
        { email: "sarah.d@gmail.com", pack: "solo", amount: 99, purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), claimed: false },
        { email: "karim.trading@protonmail.com", pack: "pro", amount: 299, purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), claimed: true, claimWallet: "0x999...1111", claimedAt: new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString(), claimTxHash: "0x9999" },
    ];

    return res.status(200).json(customers);
}
