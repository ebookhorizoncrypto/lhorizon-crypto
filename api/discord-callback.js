import { createClient } from '@supabase/supabase-js';

// Init Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY; // Support both

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('CRITICAL: Supabase Env Vars missing');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        // 1. Exchange Code for Token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: '1465251219218890895', // Hardcoded match
                client_secret: process.env.DISCORD_CLIENT_SECRET, // Must be correct on Vercel
                grant_type: 'authorization_code',
                code,
                redirect_uri: 'https://ebook-horizoncrypto.com/api/discord-callback',
            }),
        });

        const tokenData = await tokenResponse.json();
        console.log('Token Exchange Response:', JSON.stringify(tokenData));

        if (tokenData.error || !tokenData.access_token) {
            throw new Error(`Discord Token Error: ${JSON.stringify(tokenData)}`);
        }

        // 2. Get User Info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userResponse.json();
        console.log('Discord User Response:', JSON.stringify(discordUser, null, 2));

        if (!discordUser.email) {
            return res.status(400).send(`
                <h1>Erreur: Email manquant</h1>
                <p>Votre compte Discord n'a pas renvoyé d'email public.</p>
                <p>Réponse reçue: ${JSON.stringify(discordUser)}</p>
                <a href="/activer.html">Réessayer</a>
            `);
        }

        // 3. Find Customer
        const { data: customer, error: dbError } = await supabase
            .from('customers')
            .select('*')
            .eq('email', discordUser.email)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (dbError || !customer) {
            return res.status(404).send(`
                <h1>Aucun abonnement trouvé</h1>
                <p>Aucun achat actif trouvé pour l'email <strong>${discordUser.email}</strong>.</p>
                <p><a href="/activer.html">Retour</a></p>
            `);
        }

        // 4. Update DB
        await supabase
            .from('customers')
            .update({ discord_id: discordUser.id })
            .eq('id', customer.id);

        // 5. Add Role
        const guildId = process.env.DISCORD_GUILD_ID;
        const botToken = process.env.DISCORD_BOT_TOKEN;

        let roleId = process.env.DISCORD_ROLE_MEMBER_ID;
        if (customer.access_level === 'VIP') roleId = process.env.DISCORD_ROLE_VIP_ID;
        else if (customer.access_level === 'PRO') roleId = process.env.DISCORD_ROLE_PRO_ID;
        else if (customer.access_level === 'SOLO') roleId = process.env.DISCORD_ROLE_SOLO_ID;

        // Add Member + Role
        await fetch(`https://discord.com/api/guilds/${guildId}/members/${discordUser.id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: tokenData.access_token,
                roles: [roleId]
            }),
        });

        // 5b. Force Role (if already member)
        await fetch(`https://discord.com/api/guilds/${guildId}/members/${discordUser.id}/roles/${roleId}`, {
            method: 'PUT',
            headers: { Authorization: `Bot ${botToken}` }
        });

        // Success Redirect
        return res.redirect('/remerciement?activation=success');

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
