import Stripe from 'stripe';
import { Resend } from 'resend';
import 'dotenv/config';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

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
        // 1. Find Customer
        const customers = await stripe.customers.list({
            email: email,
            limit: 1
        });

        if (customers.data.length === 0) {
            // Pour UX simple, on previent si l'email n'existe pas
            return res.status(404).json({ error: 'Aucun compte trouvé avec cet email.' });
        }

        const customer = customers.data[0];

        // 2. Create Portal Session
        const session = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: `${process.env.DOMAIN || 'https://ebook-horizoncrypto.com'}/resilier.html`,
        });

        // 3. Send Email with Link
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
                    
                    <p style="font-size: 12px; color: #666;">Ce lien est temporaire et sécurisé.</p>
                </div>
            `
        });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error managing subscription:', error);
        return res.status(500).json({ error: `Erreur serveur: ${error.message}` });
    }
}
