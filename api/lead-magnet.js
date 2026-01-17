/**
 * L'Horizon Crypto - Lead Magnet API
 * Vercel Serverless Function
 * 
 * POST /api/lead-magnet
 * Body: { email: string }
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL || "L'Horizon Crypto <noreply@ebook-horizoncrypto.com>";
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #ffffff; margin: 0; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #1a1a2e 0%, #0f0f18 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(247, 147, 26, 0.2); }
        .header { background: linear-gradient(135deg, rgba(247, 147, 26, 0.2), rgba(153, 69, 255, 0.2)); padding: 40px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .header h1 { margin: 0; font-size: 26px; color: #f7931a; font-weight: 700; }
        .header p { margin: 8px 0 0; color: rgba(255,255,255,0.7); font-size: 14px; }
        .content { padding: 40px; }
        .content h2 { color: #fff; margin-top: 0; font-size: 22px; }
        .content p { line-height: 1.7; color: rgba(255,255,255,0.85); margin: 16px 0; }
        .button { display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #f7931a, #e68a00); color: #000; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; margin: 24px 0; }
        .key-box { background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 212, 255, 0.1)); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
        .key-box h3 { color: #00ff88; margin: 0 0 12px 0; font-size: 18px; }
        .key-badge { display: inline-block; background: #00ff88; color: #000; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; margin-top: 12px; }
        .benefits { background: rgba(255,255,255,0.03); border-radius: 12px; padding: 24px; margin: 24px 0; }
        .benefits h3 { color: #f7931a; margin: 0 0 16px 0; font-size: 16px; }
        .benefits ul { margin: 0; padding-left: 20px; }
        .benefits li { padding: 6px 0; color: rgba(255,255,255,0.85); }
        .cta-section { background: rgba(247, 147, 26, 0.1); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
        .cta-section h3 { color: #fff; margin: 0 0 12px 0; }
        .cta-button { display: inline-block; padding: 14px 32px; background: transparent; border: 2px solid #f7931a; color: #f7931a; text-decoration: none; border-radius: 50px; font-weight: 600; }
        .footer { padding: 24px 40px; background: rgba(0,0,0,0.3); text-align: center; font-size: 12px; color: rgba(255,255,255,0.5); }
        .footer a { color: #f7931a; text-decoration: none; }
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
            <p>Merci pour votre intérêt pour L'Horizon Crypto. Voici le premier chapitre complet — <strong>20 pages de contenu exclusif</strong>.</p>
            
            <div style="text-align: center;">
                <a href="${domain}/extraits/chapitre-1.pdf" class="button">📥 Télécharger le Chapitre 1</a>
            </div>
            
            <div class="key-box">
                <h3>🔑 Défi : Trouvez la 1ère clé !</h3>
                <p>Un mot secret est caché dans ce chapitre. Saurez-vous le trouver ?</p>
                <span class="key-badge">INDICE : C'est le tout début...</span>
            </div>
            
            <div class="benefits">
                <h3>📋 Ce que vous découvrirez :</h3>
                <ul>
                    <li>✅ Les fondamentaux de la blockchain</li>
                    <li>✅ Pourquoi 2026 est l'année charnière (MiCA)</li>
                    <li>✅ Les 3 erreurs fatales des débutants</li>
                    <li>✅ Comment le Proof of Learning fonctionne</li>
                </ul>
            </div>
            
            <div class="cta-section">
                <h3>Prêt pour la suite ?</h3>
                <p>Le guide complet avec les 12 chapitres et <strong>20$ USDC</strong> de récompense.</p>
                <a href="${domain}/#pricing" class="cta-button">Voir les offres →</a>
            </div>
            
            <p>Une question ? Répondez simplement à cet email.</p>
            <p>Bonne lecture !<br><strong>L'équipe L'Horizon Crypto</strong></p>
        </div>
        <div class="footer">
            <p>© 2026 L'Horizon Crypto. Tous droits réservés.</p>
            <p><a href="${domain}/confidentialite">Confidentialité</a> • <a href="${domain}/contact">Contact</a></p>
            <p style="margin-top: 16px; font-size: 11px;">Vous recevez cet email car vous avez demandé l'extrait gratuit.</p>
        </div>
    </div>
</body>
</html>`;
}
