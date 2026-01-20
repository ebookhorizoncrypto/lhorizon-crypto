/**
 * L'Horizon Crypto - Lead Magnet API
 * Vercel Serverless Function
 * 
 * POST /api/lead-magnet
 * Body: { email: string }
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL || "L'Horizon Crypto <contact@ebook-horizoncrypto.com>";
const domain = process.env.DOMAIN || 'https://ebook-horizoncrypto.com';

// Simple in-memory rate limiting (resets on cold start)
const rateLimiter = new Map();

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

    const { email } = req.body;

    // Validation
    if (!email || !email.includes('@') || email.length > 254) {
        return res.status(400).json({ error: 'Email invalide' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting (max 3 requests per email per hour)
    const now = Date.now();
    const rateKey = normalizedEmail;
    const rateData = rateLimiter.get(rateKey) || { count: 0, resetAt: now + 3600000 };

    if (now > rateData.resetAt) {
        rateData.count = 0;
        rateData.resetAt = now + 3600000;
    }

    if (rateData.count >= 3) {
        return res.status(429).json({ error: 'Trop de requêtes. Réessayez plus tard.' });
    }

    rateData.count++;
    rateLimiter.set(rateKey, rateData);

    try {
        // Send free extract email via Resend
        await resend.emails.send({
            from: fromEmail,
            to: normalizedEmail,
            subject: "📖 Votre extrait gratuit de L'Horizon Crypto",
            html: generateEmailHTML(domain)
        });

        console.log(`📧 Lead magnet sent to ${normalizedEmail}`);

        // Notify Discord (optional)
        if (process.env.DISCORD_WEBHOOK_URL) {
            await notifyDiscord(normalizedEmail);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Lead magnet email error:', error);
        // Still return success to prevent email enumeration attacks
        return res.status(200).json({ success: true });
    }
}

async function notifyDiscord(email) {
    try {
        const maskedEmail = email.charAt(0) + '***@' + email.split('@')[1];
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: '📧 Nouveau Lead !',
                    color: 0x627EEA,
                    fields: [
                        { name: 'Email', value: maskedEmail, inline: true },
                        { name: 'Source', value: 'Extrait Gratuit', inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }]
            })
        });
    } catch (e) {
        console.error('Discord webhook error:', e);
    }
}

function generateEmailHTML(domain) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Votre extrait gratuit</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f6f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; width: 100% !important; }
        .container { display: block; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .header { background: #1a1a2e; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 32px; margin-bottom: 5px; }
        .header h1 { margin: 0; color: #f7931a; font-size: 24px; font-weight: 700; }
        .header p { margin: 5px 0 0; color: #a0a0b0; font-size: 14px; }
        .content { padding: 30px 20px; color: #000000; line-height: 1.6; }
        h2 { color: #000000; font-size: 22px; margin-top: 0; margin-bottom: 20px; text-align: center; }
        p { margin-bottom: 15px; font-size: 16px; color: #333333; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { display: inline-block; padding: 16px 32px; background-color: #f7931a; color: #000000 !important; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(247, 147, 26, 0.3); }
        
        /* Box Challenge */
        .challenge-box { background-color: #f0fff4; border: 1px solid #00ff88; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
        .challenge-title { color: #00aa55; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        
        /* Summary Section */
        .summary-box { background-color: #f9f9f9; border: 1px solid #eeeeee; border-radius: 8px; padding: 25px; margin: 30px 0; }
        .summary-title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 20px; color: #000; border-bottom: 2px solid #ddd; padding-bottom: 10px; display: inline-block; width: 100%; }
        .summary-list { list-style: none; padding: 0; margin: 0; }
        .summary-item { margin-bottom: 20px; border-bottom: 1px solid #eaeaea; padding-bottom: 15px; }
        .summary-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .item-title { display: block; font-weight: bold; color: #000; font-size: 16px; margin-bottom: 5px; }
        .item-desc { display: block; color: #555; font-size: 14px; padding-left: 15px; border-left: 3px solid #f7931a; }
        
        /* CTA Section */
        .cta-section { text-align: center; margin-top: 40px; padding: 20px; background: #fff8f0; border: 1px dashed #f7931a; border-radius: 8px; }
        .cta-link { color: #f7931a; font-weight: bold; font-size: 18px; text-decoration: none; }
        
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
        .footer a { color: #888; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="logo">🌅</div>
            <h1>L'Horizon Crypto</h1>
            <p>Minez Votre Savoir, Récoltez Vos Récompenses</p>
        </div>

        <!-- Content -->
        <div class="content">
            <h2>Votre extrait gratuit est prêt ! 🎉</h2>
            <p>Merci pour votre intérêt. Voici le premier chapitre complet (20 pages) pour bien débuter.</p>

            <div class="button-container">
                <a href="${domain}/assets/extrait-horizon-crypto.pdf" class="button">📥 Télécharger l'Extrait PDF</a>
            </div>

            <!-- Detailed Summary -->
            <div class="summary-box">
                <div class="summary-title">Sommaire du Guide Complet</div>
                <ul class="summary-list">
                    <li class="summary-item">
                        <span class="item-title">• Introduction & Protocole d'Activation</span>
                        <span class="item-desc">Concept du "Proof of Learning" et cashback (20$ USDC).</span>
                    </li>
                    <li class="summary-item">
                        <span class="item-title">• Cadre Légal & Avertissement</span>
                        <span class="item-desc">Conformité AMF et MiCA.</span>
                    </li>
                    <li class="summary-item">
                        <span class="item-title">• PARTIE I : LES FONDATIONS (2008-2026)</span>
                        <span class="item-desc">Genèse, Bitcoin (Or numérique) et fonctionnement des Mineurs.</span>
                    </li>
                    <li class="summary-item">
                        <span class="item-title">• PARTIE II : LE RÉACTEUR TECHNIQUE</span>
                        <span class="item-desc">Blockchain, Cryptographie et Wallets (Vault).</span>
                    </li>
                    <li class="summary-item">
                        <span class="item-title">• PARTIE III : L'ÉCOSYSTEME EN ACTION</span>
                        <span class="item-desc">Transactions, Ethereum, DeFi, Stablecoins, NFTs et DAO.</span>
                    </li>
                    <li class="summary-item">
                        <span class="item-title">• PARTIE IV : MAÎTRISE AVANCÉE</span>
                        <span class="item-desc">Sécurité offensive, Analyse On-chain, Relation bancaire et Fiscalité.</span>
                    </li>
                    <li class="summary-item">
                        <span class="item-title">• PARTIE V : MISSION FINALE</span>
                        <span class="item-desc">Protocole de réclamation (Claim) des récompenses.</span>
                    </li>
                </ul>
            </div>

            <!-- Challenge Box -->
            <div class="challenge-box">
                <div class="challenge-title">🔑 Défi : Trouvez les 2 clés cachées !</div>
                <p>Deux mots secrets sont cachés dans cet extrait. Saurez-vous les trouver ?</p>
                <div style="font-size: 14px; font-weight: bold;">Le guide complet en contient 12 → 20$ USDC</div>
            </div>

            <!-- Footer CTA -->
            <div class="cta-section">
                <p><strong>Prêt pour la suite ?</strong><br>Débloquez le guide complet et les récompenses.</p>
                <a href="${domain}/#pricing" class="cta-link">Voir les Offres →</a>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>L'Horizon Crypto © 2026. Tous droits réservés.</p>
            <p><a href="${domain}">www.ebook-horizoncrypto.com</a></p>
        </div>
    </div>
</body>
</html>`;
}
