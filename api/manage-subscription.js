import Stripe from 'stripe';
import { Resend } from 'resend';
import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'placeholder'
);

const fromEmail = process.env.FROM_EMAIL || "L'Horizon Crypto <contact@ebook-horizoncrypto.com>";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }

    try {
        // 1. Find Customer in Stripe
        const customers = await stripe.customers.list({
            email: email,
            limit: 1
        });

        if (customers.data.length === 0) {
            // Pour UX simple, on previent si l'email n'existe pas
            return res.status(404).json({ error: 'Aucun compte trouvé avec cet email.' });
        }

        const customer = customers.data[0];

        // 2. Check VIP Status in Supabase
        let isVip = false;
        try {
            const { data: supaUser } = await supabase
                .from('customers')
                .select('access_level')
                .eq('email', email)
                .single();

            if (supaUser && supaUser.access_level === 'VIP') {
                isVip = true;
            }
        } catch (err) {
            console.warn('Supabase check failed, proceeding without VIP check:', err);
        }

        // 3. Create Portal Session
        const session = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: `${process.env.DOMAIN || 'https://ebook-horizoncrypto.com'}/resilier.html`,
        });

        // 4. Build Email Content
        let vipSection = '';
        if (isVip) {
            vipSection = `
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #f7931a; margin: 25px 0; text-align: left;">
                <h3 style="margin-top: 0; color: #f7931a; font-size: 16px;">👑 Espace Coaching VIP</h3>
                <p style="font-size: 13px; margin-bottom: 15px;">En tant que membre VIP, vous avez droit à 1h de coaching par mois. Réservez votre créneau ici :</p>
                <div style="text-align: center;">
                    <a href="https://calendly.com/lhorizon-crypto/coaching-vip" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; display: inline-block;">📅 Réserver mon Coaching</a>
                </div>
            </div>`;
        }

        // 5. Send Email with Link
        await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: "⚙️ Gérer votre abonnement - L'Horizon Crypto",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <h2 style="color: #f7931a;">Gestion de votre abonnement</h2>
                    <p>Vous avez demandé à accéder à votre espace client.</p>
                    <p>Cliquez sur le lien ci-dessous pour gérer vos paiements, télécharger vos factures ou résilier votre abonnement :</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${session.url}" style="background-color: #5865F2; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Accéder à mon Espace Client
                        </a>
                    </div>
                    
                    ${vipSection}
                    
                    <p style="font-size: 12px; color: #666;">Ce lien est temporaire et sécurisé.</p>

                    <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
                         <p style="margin-bottom: 10px; font-size: 14px;">Rejoignez la communauté :</p>
                         <a href="https://discord.gg/KMzs4fHZS9" style="text-decoration: none; margin: 0 10px;">
                            <img src="https://assets-global.website-files.com/6257adef93867e56f84d3092/636e0a6918e57475a843f59f_icon_clyde_blurple_RGB.png" width="24" height="24" alt="Discord" style="vertical-align: middle;">
                        </a>
                        <a href="https://www.facebook.com/profile.php?id=61586548211161" style="text-decoration: none; margin: 0 10px;">
                            <img src="https://ebook-horizoncrypto.com/assets/logo-facebook.png" width="24" height="24" alt="Facebook" style="vertical-align: middle;">
                        </a>
                        <a href="https://www.instagram.com/ebook.cryptohorizon/" style="text-decoration: none; margin: 0 10px;">
                            <img src="https://ebook-horizoncrypto.com/assets/logo-instagram.png" width="24" height="24" alt="Instagram" style="vertical-align: middle;">
                        </a>
                    </div>
                </div>
            `
        });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error managing subscription:', error);
        return res.status(500).json({ error: `Erreur serveur: ${error.message}` });
    }
}
