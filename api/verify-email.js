
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req, res) {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email requis' });
            return;
        }

        console.log(`🔍 Verifying purchase for email: ${email}`);

        // 1. Check Supabase first (most reliable - populated by webhook)
        const { data: customer, error: dbError } = await supabase
            .from('customers')
            .select('access_level, amount_paid')
            .eq('email', email.toLowerCase().trim())
            .not('access_level', 'eq', 'EXPIRED')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (customer && !dbError) {
            const pack = customer.access_level.toLowerCase();
            console.log(`✅ Found in Supabase: ${email} -> ${pack}`);
            return res.status(200).json({ success: true, pack });
        }

        // 1.5. MANUAL BYPASS FOR ADMIN/TESTING (No Stripe Key needed)
        if (email === 'adrien.orange@yahoo.fr') {
            console.log("🛡️ ADMIN BYPASS: adrien.orange@yahoo.fr -> VIP");
            return res.status(200).json({ success: true, pack: 'vip' });
        }

        console.log(`⚠️ Not in Supabase, checking Stripe for: ${email}`);

        // 2. Fallback: Check Stripe checkout sessions
        if (!process.env.STRIPE_SECRET_KEY) {
            console.error("❌ MISSING STRIPE_SECRET_KEY");
            throw new Error("Configuration serveur incomplète");
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        // Search recent checkout sessions and filter by email
        const sessions = await stripe.checkout.sessions.list({
            status: 'complete',
            limit: 50,
            expand: ['data.customer_details']
        });

        const matchingSession = sessions.data.find(s => {
            const sessionEmail = s.customer_email || s.customer_details?.email;
            return sessionEmail && sessionEmail.toLowerCase().trim() === email.toLowerCase().trim();
        });

        if (matchingSession) {
            const amount = (matchingSession.amount_total || 0) / 100;
            let pack = matchingSession.metadata?.pack || 'solo';

            if (amount >= 500) pack = 'vip';
            else if (amount >= 200) pack = 'pro';
            else if (amount > 0) pack = 'solo';

            console.log(`✅ Found in Stripe sessions: ${email} -> ${pack} (${amount}€)`);
            return res.status(200).json({ success: true, pack });
        }

        // 3. Fallback: Check Stripe customers + charges
        const customers = await stripe.customers.list({
            email: email,
            limit: 1
        });

        if (customers.data.length > 0) {
            const stripeCustomer = customers.data[0];
            const charges = await stripe.charges.list({
                customer: stripeCustomer.id,
                limit: 10
            });

            const successCharge = charges.data.find(c => c.status === 'succeeded');
            if (successCharge) {
                const amount = successCharge.amount / 100;
                let pack = 'solo';
                if (amount >= 500) pack = 'vip';
                else if (amount >= 200) pack = 'pro';

                console.log(`✅ Found in Stripe charges: ${email} -> ${pack} (${amount}€)`);
                return res.status(200).json({ success: true, pack });
            }
        }

        // 4. DEV BYPASS (test@test.com)
        if (email === 'test@test.com') {
            console.log("⚠️ TEST MODE: Bypassing verification for test@test.com");
            return res.status(200).json({ success: true, pack: 'solo' });
        }

        res.status(404).json({ error: "Aucun achat trouvé pour cet email. Assurez-vous d'utiliser l'email de votre commande Stripe." });

    } catch (error) {
        console.error('Verify Email Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
