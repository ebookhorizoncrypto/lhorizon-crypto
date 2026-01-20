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
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Message Reçu</title>
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
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px; color: #000000;">
                            <h2 style="color: #000000 !important; font-size: 20px; margin-top: 0; margin-bottom: 20px;">Merci ${name} ! 🙏</h2>
                            
                            <p style="color: #000000 !important; margin-bottom: 20px; font-size: 16px; line-height: 1.6;">
                                Nous avons bien reçu votre message. Notre équipe vous répondra <strong>sous 24 heures</strong>.
                            </p>
                            
                            <!-- Recap Message Box -->
                            <div style="background-color: #f9f9f9; border-left: 4px solid #f7931a; padding: 20px; margin: 25px 0; border-radius: 4px;">
                                <p style="color: #666666 !important; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; font-weight: bold;">Rappel de votre message :</p>
                                <p style="font-style: italic; color: #333333 !important; margin: 0; line-height: 1.5;">
                                    "${message.substring(0, 300)}${message.length > 300 ? '...' : ''}"
                                </p>
                            </div>

                            <p style="color: #000000 !important; border-top: 1px solid #eeeeee; padding-top: 20px; font-size: 14px;">
                                En attendant, avez-vous consulté notre FAQ ?
                                <br>
                                <a href="https://lhorizoncrypto.com/faq.html" style="color: #f7931a; font-weight: bold; text-decoration: none;">Voir la FAQ →</a>
                            </p>
                            
                            <p style="color: #000000 !important; margin-top: 20px; font-size: 14px;">
                                À très vite,<br>
                                <strong>L'équipe L'Horizon Crypto</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px; background-color: #f4f4f4; color: #888888; font-size: 12px; border-top: 1px solid #dddddd;">
                            <p style="margin: 0;">L'Horizon Crypto © 2026</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
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
