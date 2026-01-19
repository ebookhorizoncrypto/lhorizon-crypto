/**
 * L'Horizon Crypto - Contact Form API
 * Vercel Serverless Function
 * 
 * POST /api/contact
 * Body: { name, email, subject, message }
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const adminEmail = process.env.ADMIN_EMAIL || 'contact@ebook-horizoncrypto.com';

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

    try {
        const { name, email, subject, message } = req.body;

        // Validation
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        if (!email.includes('@')) {
            return res.status(400).json({ error: 'Email invalide' });
        }

        // Send notification to admin
        await resend.emails.send({
            from: fromEmail,
            to: adminEmail,
            replyTo: email,
            subject: `[Contact] ${subject || 'Message de ' + name}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; background: #1a1a2e; color: #fff; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #0a0a0f; border-radius: 12px; padding: 30px; }
        .header { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; margin-bottom: 20px; }
        .field { margin-bottom: 15px; }
        .label { color: #f7931a; font-weight: bold; font-size: 12px; text-transform: uppercase; }
        .value { margin-top: 5px; line-height: 1.6; }
        .message-box { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 20px; margin-top: 20px; }
        .reply-btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #f7931a; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📧 Nouveau message de contact</h2>
            <p style="color: #888;">Reçu le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
        </div>
        
        <div class="field">
            <div class="label">Nom</div>
            <div class="value">${name}</div>
        </div>
        
        <div class="field">
            <div class="label">Email</div>
            <div class="value"><a href="mailto:${email}" style="color: #f7931a;">${email}</a></div>
        </div>
        
        ${subject ? `
        <div class="field">
            <div class="label">Sujet</div>
            <div class="value">${subject}</div>
        </div>
        ` : ''}
        
        <div class="field">
            <div class="label">Message</div>
            <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
        </div>
        
        <a href="mailto:${email}?subject=Re: ${subject || 'Votre message'}" class="reply-btn">↩️ Répondre</a>
    </div>
</body>
</html>`
        });

        // Send confirmation to user
        await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: "Nous avons bien reçu votre message - L'Horizon Crypto",
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; background: #0a0a0f; color: #fff; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #f7931a, #ffb347); padding: 30px; text-align: center; }
        .header h1 { color: #000; margin: 0; font-size: 22px; }
        .content { padding: 30px; }
        .footer { padding: 20px 30px; background: rgba(0,0,0,0.3); text-align: center; font-size: 12px; color: #888; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌅 L'Horizon Crypto</h1>
        </div>
        <div class="content">
            <h2>Merci ${name} ! 🙏</h2>
            <p>Nous avons bien reçu votre message et nous vous répondrons <strong>sous 24 heures</strong>.</p>
            
            <p style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin: 20px 0;">
                <strong>Votre message :</strong><br><br>
                <em style="color: #ccc;">"${message.substring(0, 200)}${message.length > 200 ? '...' : ''}"</em>
            </p>
            
            <p>En attendant, consultez notre <a href="https://lhorizon-crypto.vercel.app/faq.html" style="color: #f7931a;">FAQ</a> pour trouver des réponses immédiates à vos questions.</p>
            
            <p>À bientôt,<br><strong>L'équipe L'Horizon Crypto</strong></p>
        </div>
        <div class="footer">
            <p>© 2026 L'Horizon Crypto. Tous droits réservés.</p>
        </div>
    </div>
</body>
</html>`
        });

        console.log(`📧 Contact form: ${name} <${email}> - ${subject}`);

        return res.status(200).json({ success: true, message: 'Message envoyé !' });

    } catch (error) {
        console.error('Contact form error:', error);
        return res.status(500).json({ error: 'Erreur lors de l\'envoi' });
    }
}
