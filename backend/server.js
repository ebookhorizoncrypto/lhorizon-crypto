/**
 * L'Horizon Crypto - Backend API
 * 
 * Endpoints:
 * - POST /api/webhook/stripe - Stripe webhook (purchase confirmation)
 * - POST /api/claim/verify-email - Verify email for claim
 * - POST /api/claim/verify-keys - Verify 12 keys
 * - POST /api/claim/process - Process claim (send USDC)
 * - GET /api/admin/stats - Dashboard stats
 * - GET /api/admin/customers - Customer list
 * 
 * Setup:
 * npm install express cors dotenv stripe resend ethers
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const Stripe = require('stripe');
const { ethers } = require('ethers');
const crypto = require('crypto');

const app = express();

// Config
const config = {
    port: process.env.PORT || 3002,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL || 'L\'Horizon Crypto <noreply@lhorizoncrypto.com>',
    baseRpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    contractAddress: process.env.POL_CONTRACT_ADDRESS,
    privateKey: process.env.OWNER_PRIVATE_KEY, // For signing contract calls
    discordWebhook: process.env.DISCORD_WEBHOOK_URL,
    secretKeys: process.env.SECRET_12_KEYS?.split(',') || [] // Your 12 secret words
};

const stripe = new Stripe(config.stripeSecretKey);
const resend = new Resend(config.resendApiKey);

// In-memory store (use database in production!)
const store = {
    customers: new Map(),
    claims: new Map(),
    stats: {
        totalSales: 0,
        totalRevenue: 0,
        totalClaims: 0,
        todaySales: 0,
        todayRevenue: 0
    }
};

// Middleware
app.use(cors());
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

// =====================================
// LEAD MAGNET - FREE EXTRACT
// =====================================

// In-memory store for leads (use database in production!)
const leads = new Map();

app.post('/api/lead-magnet', async (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Email invalide' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    if (leads.has(normalizedEmail)) {
        return res.json({ success: true, message: 'Déjà inscrit' });
    }

    // Store lead
    leads.set(normalizedEmail, {
        subscribedAt: new Date(),
        source: 'landing-page'
    });

    try {
        // Send free extract email via Resend
        await resend.emails.send({
            from: config.fromEmail,
            to: normalizedEmail,
            subject: '📖 Votre extrait gratuit de L\'Horizon Crypto',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #1a1a2e 0%, #0f0f18 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(247, 147, 26, 0.2); }
        .header { background: linear-gradient(135deg, rgba(247, 147, 26, 0.2), rgba(153, 69, 255, 0.2)); padding: 40px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .header img { max-width: 180px; margin-bottom: 16px; }
        .header h1 { margin: 0; font-size: 26px; color: #f7931a; font-weight: 700; }
        .header p { margin: 8px 0 0; color: rgba(255,255,255,0.7); font-size: 14px; }
        .content { padding: 40px; }
        .content h2 { color: #fff; margin-top: 0; font-size: 22px; }
        .content p { line-height: 1.7; color: rgba(255,255,255,0.85); margin: 16px 0; }
        .button { display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #f7931a, #e68a00); color: #000; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; margin: 24px 0; text-transform: uppercase; letter-spacing: 1px; }
        .button:hover { background: linear-gradient(135deg, #ffb347, #f7931a); }
        .key-box { background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 212, 255, 0.1)); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
        .key-box h3 { color: #00ff88; margin: 0 0 12px 0; font-size: 18px; }
        .key-box p { margin: 0; color: rgba(255,255,255,0.8); font-size: 14px; }
        .key-badge { display: inline-block; background: #00ff88; color: #000; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; margin-top: 12px; }
        .benefits { background: rgba(255,255,255,0.03); border-radius: 12px; padding: 24px; margin: 24px 0; }
        .benefits h3 { color: #f7931a; margin: 0 0 16px 0; font-size: 16px; }
        .benefits ul { margin: 0; padding-left: 20px; }
        .benefits li { padding: 6px 0; color: rgba(255,255,255,0.85); }
        .cta-section { background: rgba(247, 147, 26, 0.1); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
        .cta-section h3 { color: #fff; margin: 0 0 12px 0; }
        .cta-section p { margin: 0 0 16px 0; color: rgba(255,255,255,0.7); font-size: 14px; }
        .cta-button { display: inline-block; padding: 14px 32px; background: transparent; border: 2px solid #f7931a; color: #f7931a; text-decoration: none; border-radius: 50px; font-weight: 600; }
        .footer { padding: 24px 40px; background: rgba(0,0,0,0.3); text-align: center; font-size: 12px; color: rgba(255,255,255,0.5); }
        .footer a { color: #f7931a; text-decoration: none; }
        .social { margin: 16px 0; }
        .social a { display: inline-block; margin: 0 8px; color: rgba(255,255,255,0.6); text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌅 L'Horizon Crypto</h1>
            <p>Minez Votre Savoir, Récoltez Vos Récompenses</p>
        </div>
        <div class="content">
            <h2>Votre extrait gratuit est prêt ! 🎉</h2>
            <p>Merci pour votre intérêt pour L'Horizon Crypto. Voici le premier chapitre complet du guide — <strong>20 pages de contenu exclusif</strong> pour commencer votre aventure dans l'univers crypto.</p>
            
            <div style="text-align: center;">
                <a href="https://ebook-horizoncrypto.com/extraits/chapitre-1.pdf" class="button">📥 Télécharger le Chapitre 1</a>
            </div>
            
            <div class="key-box">
                <h3>🔑 Défi : Trouvez la 1ère clé !</h3>
                <p>Un mot secret est caché quelque part dans ce chapitre. Saurez-vous le trouver ?</p>
                <span class="key-badge">INDICE : C'est le tout début...</span>
            </div>
            
            <div class="benefits">
                <h3>📋 Ce que vous découvrirez :</h3>
                <ul>
                    <li>✅ Les fondamentaux de la blockchain expliqués simplement</li>
                    <li>✅ Pourquoi 2026 est l'année charnière (MiCA)</li>
                    <li>✅ Les 3 erreurs fatales des débutants</li>
                    <li>✅ Comment le Proof of Learning fonctionne</li>
                </ul>
            </div>
            
            <div class="cta-section">
                <h3>Prêt pour la suite ?</h3>
                <p>Obtenez le guide complet avec les 12 chapitres et débloquez <strong>20$ USDC</strong> sur la blockchain Base.</p>
                <a href="https://ebook-horizoncrypto.com/#pricing" class="cta-button">Voir les offres →</a>
            </div>
            
            <p>Une question ? Répondez simplement à cet email.</p>
            <p>Bonne lecture !<br><strong>L'équipe L'Horizon Crypto</strong></p>
        </div>
        <div class="footer">
            <p>© 2026 L'Horizon Crypto. Tous droits réservés.</p>
            <p><a href="https://ebook-horizoncrypto.com/confidentialite">Confidentialité</a> • <a href="https://ebook-horizoncrypto.com/contact">Contact</a></p>
            <p style="margin-top: 16px; font-size: 11px;">Vous recevez cet email car vous avez demandé l'extrait gratuit. <a href="#">Se désabonner</a></p>
        </div>
    </div>
</body>
</html>
            `
        });

        console.log(`📧 Lead magnet sent to ${normalizedEmail}`);

        // Notify Discord (optional)
        if (config.discordWebhook) {
            await fetch(config.discordWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: '📧 Nouveau Lead !',
                        color: 0x627EEA,
                        fields: [
                            { name: 'Email', value: maskEmail(normalizedEmail), inline: true },
                            { name: 'Source', value: 'Extrait Gratuit', inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                })
            }).catch(() => { });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Lead magnet email error:', error);
        // Still mark as subscribed to prevent spam
        res.json({ success: true });
    }
});

// =====================================
// STRIPE WEBHOOK
// =====================================

app.post('/api/webhook/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
    } catch (err) {
        console.error('Webhook error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Store customer
        const customer = {
            email: session.customer_email,
            pack: session.metadata?.pack || 'solo',
            amount: session.amount_total / 100,
            purchasedAt: new Date(),
            claimed: false,
            downloadCount: 0
        };

        store.customers.set(session.customer_email, customer);

        // Update stats
        store.stats.totalSales++;
        store.stats.totalRevenue += customer.amount;
        store.stats.todaySales++;
        store.stats.todayRevenue += customer.amount;

        // Send confirmation email
        await sendPurchaseEmail(customer);

        // Notify Discord
        await notifyDiscord('purchase', customer);

        console.log(`✅ New purchase: ${customer.email} - ${customer.pack} - ${customer.amount}€`);
    }

    res.json({ received: true });
});

// =====================================
// EMAIL FUNCTIONS (RESEND)
// =====================================

async function sendPurchaseEmail(customer) {
    try {
        const packNames = {
            solo: 'Pack Solo',
            pro: 'Pack Pro',
            vip: 'Pack VIP'
        };

        await resend.emails.send({
            from: config.fromEmail,
            to: customer.email,
            subject: '🎉 Votre Guide L\'Horizon Crypto est prêt !',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #ffffff; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #f7931a, #ffb347); padding: 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; color: #000; }
        .content { padding: 40px; }
        .content h2 { color: #f7931a; margin-top: 0; }
        .button { display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #f7931a, #e68a00); color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .info-box { background: rgba(247, 147, 26, 0.1); border: 1px solid rgba(247, 147, 26, 0.3); border-radius: 8px; padding: 20px; margin: 20px 0; }
        .reward-badge { background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 8px; padding: 20px; text-align: center; }
        .reward-badge h3 { color: #00ff88; margin: 0 0 10px 0; }
        .footer { padding: 20px 40px; background: #0a0a0f; text-align: center; font-size: 12px; color: #888; }
        .footer a { color: #f7931a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌅 L'Horizon Crypto</h1>
        </div>
        <div class="content">
            <h2>Félicitations pour votre achat !</h2>
            <p>Bonjour,</p>
            <p>Merci pour votre confiance ! Votre <strong>${packNames[customer.pack] || 'Guide'}</strong> est maintenant disponible.</p>
            
            <div style="text-align: center;">
                <a href="https://lhorizoncrypto.com/download?token=XXX" class="button">📥 Télécharger mon Guide</a>
            </div>
            
            <div class="info-box">
                <h3>📋 Ce qui vous attend :</h3>
                <ul>
                    <li>✅ Guide PDF complet (100+ pages)</li>
                    <li>✅ 12 clés secrètes à découvrir</li>
                    <li>✅ Guide Airdrops 2026 bonus</li>
                    ${customer.pack !== 'solo' ? '<li>✅ Accès Discord Communauté</li>' : ''}
                    ${customer.pack === 'pro' ? '<li>✅ 30 min de coaching (lien Calendly envoyé séparément)</li>' : ''}
                    ${customer.pack === 'vip' ? '<li>✅ 1h de coaching privé (lien Calendly envoyé séparément)</li>' : ''}
                </ul>
            </div>
            
            <div class="reward-badge">
                <h3>💰 20$ USDC vous attendent !</h3>
                <p>Trouvez les 12 clés cachées dans le guide et réclamez votre récompense sur la blockchain Base.</p>
                <a href="https://lhorizoncrypto.com/claim" class="button" style="background: linear-gradient(135deg, #00ff88, #00d4ff);">🎁 Réclamer ma récompense</a>
            </div>
            
            <p>Une question ? Répondez à cet email ou contactez-nous sur <a href="https://discord.gg/xxx" style="color: #f7931a;">Discord</a>.</p>
            
            <p>Bonne lecture et à très vite !<br>
            <strong>L'équipe L'Horizon Crypto</strong></p>
        </div>
        <div class="footer">
            <p>© 2026 L'Horizon Crypto. Tous droits réservés.</p>
            <p><a href="https://lhorizoncrypto.com/cgv">CGV</a> | <a href="https://lhorizoncrypto.com/confidentialite">Confidentialité</a></p>
        </div>
    </div>
</body>
</html>
            `
        });

        console.log(`📧 Email sent to ${customer.email}`);
    } catch (error) {
        console.error('Email error:', error);
    }
}

// =====================================
// CLAIM API
// =====================================

// Step 1: Verify email has purchased
app.post('/api/claim/verify-email', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }

    const customer = store.customers.get(email.toLowerCase());

    if (!customer) {
        return res.status(404).json({ error: 'Aucun achat trouvé pour cet email' });
    }

    if (customer.claimed) {
        return res.status(400).json({ error: 'Récompense déjà réclamée' });
    }

    // Check 90-day limit
    const daysSincePurchase = (Date.now() - customer.purchasedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePurchase > 90) {
        return res.status(400).json({ error: 'Délai de réclamation expiré (90 jours)' });
    }

    res.json({
        success: true,
        pack: customer.pack,
        purchasedAt: customer.purchasedAt
    });
});

// Step 2: Verify 12 keys
app.post('/api/claim/verify-keys', async (req, res) => {
    const { email, keys } = req.body;

    if (!email || !keys || keys.length !== 12) {
        return res.status(400).json({ error: 'Email et 12 clés requis' });
    }

    const customer = store.customers.get(email.toLowerCase());
    if (!customer) {
        return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Verify keys
    const normalizedKeys = keys.map(k => k.toLowerCase().trim());
    const isValid = config.secretKeys.every((key, index) =>
        normalizedKeys[index] === key.toLowerCase().trim()
    );

    // Notify Discord of attempt
    await notifyDiscord('claim-attempt', {
        email,
        keysValid: isValid
    });

    if (!isValid) {
        // Mark as failed attempt (one try only)
        customer.claimAttemptFailed = true;
        return res.status(400).json({ error: 'Clés incorrectes. Vous n\'avez qu\'une seule tentative.' });
    }

    // Generate claim token
    const claimToken = crypto.randomBytes(32).toString('hex');
    store.claims.set(claimToken, { email, expiresAt: Date.now() + 15 * 60 * 1000 }); // 15 min expiry

    res.json({ success: true, claimToken });
});

// Step 3: Process claim (send USDC)
app.post('/api/claim/process', async (req, res) => {
    const { claimToken, walletAddress } = req.body;

    if (!claimToken || !walletAddress) {
        return res.status(400).json({ error: 'Token et wallet requis' });
    }

    // Verify claim token
    const claim = store.claims.get(claimToken);
    if (!claim || claim.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    // Verify wallet address format
    if (!ethers.isAddress(walletAddress)) {
        return res.status(400).json({ error: 'Adresse wallet invalide' });
    }

    const customer = store.customers.get(claim.email);
    if (!customer || customer.claimed) {
        return res.status(400).json({ error: 'Claim invalide' });
    }

    try {
        // Call smart contract
        const txHash = await processOnChainClaim(claim.email, walletAddress);

        // Mark as claimed
        customer.claimed = true;
        customer.claimedAt = new Date();
        customer.claimWallet = walletAddress;
        customer.claimTxHash = txHash;

        // Update stats
        store.stats.totalClaims++;

        // Clean up claim token
        store.claims.delete(claimToken);

        // Notify Discord
        await notifyDiscord('claim-success', {
            email: claim.email,
            wallet: walletAddress,
            txHash
        });

        res.json({
            success: true,
            txHash,
            explorerUrl: `https://basescan.org/tx/${txHash}`
        });

    } catch (error) {
        console.error('Claim processing error:', error);
        res.status(500).json({ error: 'Erreur lors du traitement. Contactez le support.' });
    }
});

// =====================================
// SMART CONTRACT INTERACTION
// =====================================

async function processOnChainClaim(email, walletAddress) {
    if (!config.contractAddress || !config.privateKey) {
        // Demo mode - return mock tx
        console.log('⚠️ Demo mode: No contract configured');
        return '0x' + crypto.randomBytes(32).toString('hex');
    }

    const provider = new ethers.JsonRpcProvider(config.baseRpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);

    const contractABI = [
        "function processClaim(address recipient, bytes32 emailHash) external"
    ];

    const contract = new ethers.Contract(config.contractAddress, contractABI, wallet);

    const emailHash = ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase()));

    const tx = await contract.processClaim(walletAddress, emailHash);
    const receipt = await tx.wait();

    return receipt.hash;
}

// =====================================
// ADMIN DASHBOARD API
// =====================================

// Basic auth middleware
function adminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
        return res.status(401).json({ error: 'Non autorisé' });
    }
    next();
}

// Stats endpoint
app.get('/api/admin/stats', adminAuth, (req, res) => {
    res.json({
        totalSales: store.stats.totalSales,
        totalRevenue: store.stats.totalRevenue,
        totalClaims: store.stats.totalClaims,
        todaySales: store.stats.todaySales,
        todayRevenue: store.stats.todayRevenue,
        claimRate: store.stats.totalSales > 0
            ? ((store.stats.totalClaims / store.stats.totalSales) * 100).toFixed(1) + '%'
            : '0%'
    });
});

// Customers list
app.get('/api/admin/customers', adminAuth, (req, res) => {
    const customers = Array.from(store.customers.entries()).map(([email, data]) => ({
        email,
        pack: data.pack,
        amount: data.amount,
        purchasedAt: data.purchasedAt,
        claimed: data.claimed,
        claimedAt: data.claimedAt,
        claimWallet: data.claimWallet
    }));

    res.json(customers);
});

// Recent activity
app.get('/api/admin/activity', adminAuth, (req, res) => {
    // TODO: Implement activity log
    res.json([]);
});

// =====================================
// DISCORD NOTIFICATIONS
// =====================================

async function notifyDiscord(type, data) {
    if (!config.discordWebhook) return;

    const embeds = {
        'purchase': {
            title: '💰 Nouvel Achat !',
            color: 0x00FF88,
            fields: [
                { name: '📧 Email', value: maskEmail(data.email), inline: true },
                { name: '📦 Pack', value: data.pack, inline: true },
                { name: '💵 Montant', value: `${data.amount}€`, inline: true }
            ]
        },
        'claim-attempt': {
            title: '⏳ Tentative de Claim',
            color: 0xFFA500,
            fields: [
                { name: '📧 Email', value: maskEmail(data.email), inline: true },
                { name: '🔑 Clés valides', value: data.keysValid ? '✅ Oui' : '❌ Non', inline: true }
            ]
        },
        'claim-success': {
            title: '✅ Récompense Envoyée !',
            color: 0x00FF00,
            fields: [
                { name: '📧 Email', value: maskEmail(data.email), inline: true },
                { name: '👛 Wallet', value: shortenAddress(data.wallet), inline: true },
                { name: '📋 TX', value: `[BaseScan](https://basescan.org/tx/${data.txHash})`, inline: false }
            ]
        }
    };

    try {
        await fetch(config.discordWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{ ...embeds[type], timestamp: new Date().toISOString() }]
            })
        });
    } catch (error) {
        console.error('Discord webhook error:', error);
    }
}

function maskEmail(email) {
    const [name, domain] = email.split('@');
    return `${name.charAt(0)}***@${domain}`;
}

function shortenAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// =====================================
// START SERVER
// =====================================

app.listen(config.port, () => {
    console.log(`🚀 Backend API running on port ${config.port}`);
    console.log(`📧 Email provider: Resend`);
    console.log(`💳 Stripe: ${config.stripeSecretKey ? 'Configured' : 'Not configured'}`);
    console.log(`⛓️ Contract: ${config.contractAddress || 'Demo mode'}`);
});

module.exports = app;
