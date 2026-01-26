/**
 * L'Horizon Crypto - Stripe Webhook Handler
 * Vercel Serverless Function
 * 
 * POST /api/webhook/stripe
 */

import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const fromEmail = process.env.FROM_EMAIL || "L'Horizon Crypto <contact@ebook-horizoncrypto.com>";
const domain = process.env.DOMAIN || 'https://ebook-horizoncrypto.com';

// Required for Stripe webhooks - don't parse body
export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
            await handleSuccessfulPayment(session);
        } catch (error) {
            console.error('❌ Error handling payment:', error);
            // Don't fail the webhook - Stripe will retry
        }
    }

    res.status(200).json({ received: true });
}

// Init Supabase
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'placeholder'
);

async function handleSuccessfulPayment(session) {
    const email = session.customer_email || session.customer_details?.email;
    let pack = session.metadata?.pack || 'solo';
    const amount = (session.amount_total || 0) / 100;

    // Robust pack detection
    if (Math.round(amount) >= 290 && Math.round(amount) < 500) pack = 'pro';
    if (Math.round(amount) >= 540) pack = 'vip';

    console.log(`✅ New purchase: ${email} - ${pack} - ${amount}€`);

    // Calculate Expiration
    const expiresAt = new Date();
    if (pack === 'solo') expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
    else if (pack === 'pro') expiresAt.setMonth(expiresAt.getMonth() + 3); // 3 months
    else expiresAt.setFullYear(expiresAt.getFullYear() + 100); // Lifetime (VIP)

    // Insert into Supabase
    const { error } = await supabase.from('customers').upsert({
        email: email,
        stripe_customer_id: session.customer,
        access_level: pack.toUpperCase(),
        amount_paid: amount,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
    }, { onConflict: 'email' });

    if (error) {
        console.error('❌ Supabase Insert Error:', error);
    } else {
        console.log('✅ Customer saved to Supabase');
    }

    // Send confirmation email
    await sendPurchaseEmail(email, pack, amount);

    // Notify Discord
    if (process.env.DISCORD_WEBHOOK_URL) {
        await notifyDiscord('purchase', { email, pack, amount });
    }
}

async function sendPurchaseEmail(email, pack, amount) {
    // Robust pack detection based on amount if metadata is missing
    // Default is 'solo' from handler
    if (Math.round(amount) >= 290 && Math.round(amount) < 500) pack = 'pro';
    if (Math.round(amount) >= 540) pack = 'vip';

    const packNames = {
        solo: 'Pack Solo 🥉',
        pro: 'Pack Pro 🥈',
        vip: 'Pack VIP 🥇'
    };

    const downloadLink = `${domain}/assets/Horizon-Crypto-Ebook.pdf`; // Direct link assuming assets
    const discordLink = `${domain}/activer.html`; // New Activation Flow
    const calendlyLink = "https://calendly.com/lhorizon-crypto/coaching-vip"; // Example
    const claimLink = `${domain}/claim.html`;

    // Content Customization
    let specificContent = '';
    let emailTitle = '';

    if (pack === 'vip') {
        emailTitle = "🥇 Confirmation Pack VIP - L'Horizon Crypto";
        specificContent = `
            <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #f7931a; margin-bottom: 25px;">
                <h3 style="margin-top: 0; color: #f7931a;">Votre Accès VIP est débloqué !</h3>
                <ul style="padding-left: 20px; color: #333; line-height: 1.6;">
                    <li><strong>Coaching Privé :</strong> 1h d'appel stratégique avec nos experts.</li>
                    <li><strong>Accès Discord Secret :</strong> Le canal des baleines vous attend.</li>
                    <li><strong>Ebook Complet :</strong> La bible de la crypto.</li>
                </ul>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="${calendlyLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">📅 Réserver mon Coaching</a>
                </div>
            </div>
            <p><strong>Étape Cruciale :</strong> Reliez votre compte Discord pour accéder aux salons privés.</p>
            <div style="text-align: center; margin-bottom: 20px;">
                 <a href="${discordLink}" style="color: #5865F2; font-weight: bold; text-decoration: none; font-size: 16px;">👾 Activer mon accès Discord VIP →</a>
            </div>
        `;
    } else if (pack === 'pro') {
        emailTitle = "🥈 Confirmation Pack Pro - L'Horizon Crypto";
        specificContent = `
            <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #627EEA; margin-bottom: 25px;">
                <h3 style="margin-top: 0; color: #627EEA;">Vous passez au niveau supérieur !</h3>
                <ul style="padding-left: 20px; color: #333; line-height: 1.6;">
                    <li><strong>Masterclass Mensuelle :</strong> Accès aux lives d'analyse.</li>
                    <li><strong>Discord Pro :</strong> Signaux et entraide prioritaire.</li>
                    <li><strong>Ebook Complet :</strong> Toutes les stratégies avancées.</li>
                </ul>
                <div style="text-align: center; margin-top: 20px;">
                    <a href="${discordLink}" style="background-color: #5865F2; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">👾 Activer mon accès Discord Pro</a>
                </div>
            </div>
        `;
    } else {
        // SOLO (Ebook + Discord 30j)
        emailTitle = "🥉 Confirmation Pack Solo - L'Horizon Crypto";
        specificContent = `
            <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #f7931a; margin-bottom: 25px;">
                <h3 style="margin-top: 0; color: #f7931a;">Votre Commande est Validée !</h3>
                <ul style="padding-left: 20px; color: #333; line-height: 1.6;">
                    <li><strong>Guide PDF Complet :</strong> Téléchargement immédiat ci-dessus.</li>
                    <li><strong>Accès Discord (30 jours) :</strong> Rejoignez la communauté pour 1 mois.</li>
                </ul>
            </div>
            <p><strong>Indispensable :</strong> Reliez votre compte Discord maintenant pour démarrer vos 30 jours.</p>
            <div style="text-align: center; margin-bottom: 20px;">
                 <a href="${discordLink}" style="background-color: #5865F2; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">👾 Activer mon accès Discord (30j)</a>
            </div>
        `;
    }

    await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: emailTitle,
        html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Confirmation Commande</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; color: #000000; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #dddddd; max-width: 600px; width: 100%;">
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background-color: #1a1a2e; padding: 30px;">
                            <div style="font-size: 32px; margin-bottom: 5px;">🌅</div>
                            <h1 style="margin: 0; color: #f7931a; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif;">L'Horizon Crypto</h1>
                            <p style="color: #ccc; margin: 5px 0 0; font-size: 14px;">Merci pour votre commande !</p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px; color: #000000;">
                            <h2 style="color: #000000 !important; font-size: 22px; margin-top: 0; margin-bottom: 20px;">
                                ${packNames[pack] || 'Confirmation Commande'}
                            </h2>
                            
                            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                                Félicitations ! Vous venez de faire un grand pas vers votre souveraineté financière. Voici vos accès immédiats.
                            </p>

                            <!-- DOWNLOAD BUTTON (Main Action) -->
                            <div style="text-align: center; margin-bottom: 30px;">
                                <a href="${downloadLink}" download style="background-color: #f7931a; color: #000000 !important; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; display: inline-block; box-shadow: 0 4px 15px rgba(247, 147, 26, 0.3);">
                                    📥 Télécharger le Guide (PDF)
                                </a>
                                <p style="font-size: 12px; color: #666; margin-top: 10px;">Lien direct, pas d'inscription requise.</p>
                            </div>

                            <!-- Specific Pack Content -->
                            ${specificContent}

                            <!-- REWARD SECTION (Common to all) -->
                            <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 30px;">
                                <div style="background-color: #e6fffa; border: 1px solid #b2f5ea; border-radius: 12px; padding: 20px; text-align: center;">
                                    <h3 style="color: #009970; margin-top: 0;">💰 N'oubliez pas vos 100$ !</h3>
                                    <p style="font-size: 14px; margin-bottom: 15px; color: #333;">
                                        12 mots-clés sont cachés dans le guide. Trouvez-les tous pour débloquer votre récompense sur la blockchain.
                                    </p>
                                    <a href="${claimLink}" style="color: #009970; font-weight: bold; text-decoration: underline;">Accéder à la page de réclamation →</a>
                                </div>
                            </div>
                            
                            <p style="color: #000000 !important; margin-top: 30px; font-size: 14px; text-align: center;">
                                Une question ? Répondez simplement à cet email.<br>
                                <strong>L'équipe L'Horizon Crypto</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px; background-color: #f4f4f4; color: #888888; font-size: 12px; border-top: 1px solid #dddddd;">
                            <p style="margin: 0;">L'Horizon Crypto © 2026. Tous droits réservés.</p>
                            <p style="margin: 5px 0 0;">
                                <a href="${domain}/cgv.html" style="color: #888; text-decoration: underline;">CGV</a> | 
                                <a href="${domain}/confidentialite.html" style="color: #888; text-decoration: underline;">Confidentialité</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
    });

    console.log(`📧 Purchase email sent to ${email} (Pack: ${pack})`);
}

async function notifyDiscord(type, data) {
    const maskedEmail = data.email.charAt(0) + '***@' + data.email.split('@')[1];

    await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            embeds: [{
                title: '💰 Nouvel Achat !',
                color: 0x00FF88,
                fields: [
                    { name: '📧 Email', value: maskedEmail, inline: true },
                    { name: '📦 Pack', value: data.pack, inline: true },
                    { name: '💵 Montant', value: `${data.amount}€`, inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        })
    });
}
