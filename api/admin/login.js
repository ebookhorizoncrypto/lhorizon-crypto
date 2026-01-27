export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { key } = req.body;

    // Server-side check of the environment variable
    if (!process.env.ADMIN_KEY) {
        console.error("❌ ADMIN_KEY not set in environment variables");
        return res.status(500).json({ error: 'Server misconfiguration' });
    }

    if (key === process.env.ADMIN_KEY) {
        return res.status(200).json({ success: true });
    } else {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}
