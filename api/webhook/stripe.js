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

const fromEmail = process.env.FROM_EMAIL || "L'Horizon Crypto <noreply@ebook-horizoncrypto.com>";
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

async function handleSuccessfulPayment(session) {
    const email = session.customer_email || session.customer_details?.email;
    const pack = session.metadata?.pack || 'solo';
    const amount = (session.amount_total || 0) / 100;

    console.log(`✅ New purchase: ${email} - ${pack} - ${amount}€`);

    // Send confirmation email
    await sendPurchaseEmail(email, pack, amount);

    // Notify Discord
    if (process.env.DISCORD_WEBHOOK_URL) {
        await notifyDiscord('purchase', { email, pack, amount });
    }
}

async function sendPurchaseEmail(email, pack, amount) {
    const packNames = {
        solo: 'Pack Solo',
        pro: 'Pack Pro',
        vip: 'Pack VIP'
    };

    await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: "🎉 Votre Guide L'Horizon Crypto est prêt !",
        html: `<!DOCTYPE html>
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
            <p>Merci pour votre confiance ! Votre <strong>${packNames[pack] || 'Guide'}</strong> est maintenant disponible.</p>
            
            <div style="text-align: center;">
                <a href="${process.env.PDF_DOWNLOAD_URL || domain + '/download'}" class="button">📥 Télécharger mon Guide</a>
            </div>
            
            <div class="info-box">
                <h3>📋 Ce qui vous attend :</h3>
                <ul>
                    <li>✅ Guide PDF complet (100+ pages)</li>
                    <li>✅ 12 clés secrètes à découvrir</li>
                    <li>✅ Guide Airdrops 2026 bonus</li>
                    ${pack !== 'solo' ? '<li>✅ Accès Discord Communauté</li>' : ''}
                    ${pack === 'pro' ? '<li>✅ 30 min de coaching</li>' : ''}
                    ${pack === 'vip' ? '<li>✅ 1h de coaching privé</li>' : ''}
                </ul>
            </div>
            
            <div class="reward-badge">
                <h3>💰 20$ USDC vous attendent !</h3>
                <p>Trouvez les 12 clés cachées et réclamez votre récompense.</p>
                <a href="${domain}/claim" class="button" style="background: linear-gradient(135deg, #00ff88, #00d4ff);">🎁 Réclamer ma récompense</a>
            </div>
            
            <p>Une question ? Répondez à cet email.</p>
            <p>Bonne lecture !<br><strong>L'équipe L'Horizon Crypto</strong></p>
        </div>
        <div class="footer">
            <p>© 2026 L'Horizon Crypto. Tous droits réservés.</p>
            <p><a href="${domain}/cgv">CGV</a> | <a href="${domain}/confidentialite">Confidentialité</a></p>
        </div>
    </div>
</body>
</html>`
    });

    console.log(`📧 Purchase email sent to ${email}`);
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
