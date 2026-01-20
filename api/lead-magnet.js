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
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Votre extrait gratuit</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; color: #000000; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <!-- Main Container -->
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #dddddd; max-width: 600px; width: 100%;">
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background-color: #1a1a2e; padding: 30px; color: #ffffff;">
                            <div style="font-size: 32px; margin-bottom: 5px;">🌅</div>
                            <h1 style="margin: 0; color: #f7931a; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif;">L'Horizon Crypto</h1>
                            <p style="margin: 5px 0 0; color: #a0a0b0; font-size: 14px;">Minez Votre Savoir, Récoltez Vos Récompenses</p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px; color: #000000;">
                            <h2 style="color: #000000 !important; font-size: 22px; margin-top: 0; margin-bottom: 20px; text-align: center;">Votre extrait gratuit est prêt ! 🎉</h2>
                            
                            <p style="color: #000000 !important; margin-bottom: 20px; font-size: 16px; line-height: 1.6;">
                                Merci pour votre intérêt. Voici le premier chapitre complet (20 pages) pour bien débuter votre aventure.
                            </p>

                            <!-- Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${domain}/assets/extrait-horizon-crypto.pdf" style="display: inline-block; padding: 16px 32px; background-color: #f7931a; color: #000000 !important; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px;">📥 Télécharger l'Extrait PDF</a>
                            </div>

                            <!-- Summary -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9f9f9; border: 1px solid #eeeeee; border-radius: 8px; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <div style="font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 20px; color: #000000 !important; border-bottom: 2px solid #ddd; padding-bottom: 10px;">
                                            Sommaire du Guide Complet
                                        </div>
                                        
                                        <!-- List Items -->
                                        <p style="margin: 0 0 15px 0; color: #000000 !important;">
                                            <strong style="color: #000000 !important;">• Introduction & Protocole</strong><br>
                                            <span style="color: #555555 !important; font-size: 14px;">"Proof of Learning" et cashback (jusqu'à 100$ USDC).</span>
                                        </p>
                                        
                                        <p style="margin: 0 0 15px 0; color: #000000 !important;">
                                            <strong style="color: #000000 !important;">• Cadre Légal</strong><br>
                                            <span style="color: #555555 !important; font-size: 14px;">Conformité AMF et MiCA.</span>
                                        </p>

                                        <p style="margin: 0 0 15px 0; color: #000000 !important;">
                                            <strong style="color: #000000 !important;">• PARTIE I : LES FONDATIONS</strong><br>
                                            <span style="color: #555555 !important; font-size: 14px;">Genèse, Bitcoin et Mineurs.</span>
                                        </p>

                                        <p style="margin: 0 0 15px 0; color: #000000 !important;">
                                            <strong style="color: #000000 !important;">• PARTIE II : LE RÉACTEUR</strong><br>
                                            <span style="color: #555555 !important; font-size: 14px;">Blockchain, Cryptographie et Wallets.</span>
                                        </p>

                                        <p style="margin: 0 0 15px 0; color: #000000 !important;">
                                            <strong style="color: #000000 !important;">• PARTIE III : L'ÉCOSYSTEME</strong><br>
                                            <span style="color: #555555 !important; font-size: 14px;">Ethereum, DeFi, Stablecoins, NFTs.</span>
                                        </p>
                                        
                                        <p style="margin: 0 0 15px 0; color: #000000 !important;">
                                            <strong style="color: #000000 !important;">• PARTIE IV : MAÎTRISE</strong><br>
                                            <span style="color: #555555 !important; font-size: 14px;">Sécurité, Analyse On-chain et Fiscalité.</span>
                                        </p>
                                        
                                        <p style="margin: 0 0 0 0; color: #000000 !important;">
                                            <strong style="color: #000000 !important;">• PARTIE V : MISSION FINALE</strong><br>
                                            <span style="color: #555555 !important; font-size: 14px;">Protocole de réclamation (Claim).</span>
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Challenge Box -->
                            <div style="background-color: #f0fff4; border: 1px solid #00ff88; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                                <div style="color: #00aa55 !important; font-size: 18px; font-weight: bold; margin-bottom: 10px;">🔑 Défi : Trouvez les 2 clés cachées !</div>
                                <p style="color: #000000 !important; margin: 0 0 10px 0;">Deux mots secrets sont cachés dans cet extrait.</p>
                                <div style="font-size: 14px; font-weight: bold; color: #000000 !important;">Le guide complet en contient 12 → jusqu'à 100$ USDC</div>
                            </div>

                            <!-- Footer CTA -->
                            <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #fff8f0; border: 1px dashed #f7931a; border-radius: 8px;">
                                <p style="color: #000000 !important; margin: 0 0 10px 0; font-weight: bold;">Prêt pour la suite ?</p>
                                <a href="${domain}/#pricing" style="color: #f7931a !important; font-weight: bold; font-size: 18px; text-decoration: none;">Voir les Offres →</a>
                            </div>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px; background-color: #f4f4f4; color: #888888; font-size: 12px; border-top: 1px solid #dddddd;">
                            <p style="margin: 0 0 5px 0;">L'Horizon Crypto © 2026</p>
                            <a href="${domain}" style="color: #888888; text-decoration: none;">www.ebook-horizoncrypto.com</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
