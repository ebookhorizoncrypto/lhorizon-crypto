require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const axios = require('axios');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI; // https://votre-app.onrender.com/auth/discord/callback
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must be SERVICE KEY to write

const ROLES = {
    'SOLO': process.env.ROLE_ID_SOLO,
    'PRO': process.env.ROLE_ID_PRO,
    'VIP': process.env.ROLE_ID_VIP,
    'DISCORD': process.env.ROLE_ID_DISCORD // Role "Membre" if just subscription
};

// --- INIT CLIENTS ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});
const app = express();

// --- DISCORD BOT ---
client.once('ready', () => {
    console.log(`🤖 Activation Bot ready as ${client.user.tag}`);
});

client.login(DISCORD_BOT_TOKEN);

// --- EXPRESS SERVER (OAUTH) ---

app.get('/', (req, res) => {
    res.send('L\'Horizon Crypto Activation Bot is running. 🟢');
});

// 1. Route to start login: /activate?email=customer@example.com
app.get('/activate', (req, res) => {
    const email = req.query.email;
    if (!email) return res.send("❌ Email manquant dans le lien d'activation.");

    // Encode email in state to pass it through Discord OAuth
    const state = Buffer.from(email).toString('base64');

    // Construct Discord OAuth URL
    // Scopes: identify (to get ID), guilds.join (to add them to server via scope is complex, easier to use bot)
    // Actually we act as bot adding them, so we just need their ID.
    // User needs to be in server? Or we add them?
    // If we use 'guilds.join' scope, we can add them.
    // For simplicity, let's assume they join manually or we send invite.
    // We just need 'identify'.

    const scope = 'identify';
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${scope}&state=${state}`;

    res.redirect(authUrl);
});

// 2. Callback
app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) return res.send('❌ Paramètres invalides.');

    try {
        // Decode email
        const email = Buffer.from(state, 'base64').toString('ascii');

        // Exchange code for token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: DISCORD_REDIRECT_URI
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // Get User Info
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const discordUser = userResponse.data;
        const discordId = discordUser.id;

        console.log(`🔗 Linking ${email} to Discord ID ${discordId}`);

        // Update Supabase
        // 1. Check if customer exists and paid
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('*')
            .eq('email', email)
            .single();

        if (fetchError || !customer) {
            return res.send(`❌ Aucun achat trouvé pour l'email ${email}. Vérifiez l'adresse utilisée lors du paiement.`);
        }

        // 2. Update DB
        const { error: updateError } = await supabase
            .from('customers')
            .update({ discord_id: discordId })
            .eq('email', email);

        if (updateError) {
            console.error(updateError);
            return res.send("❌ Erreur lors de la sauvegarde en base de données.");
        }

        // 3. Assign Role via Bot
        await assignRole(discordId, customer.access_level);

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #00ff88;">Activation Réussie ! ✅</h1>
                <p>Votre compte Discord <strong>${discordUser.username}</strong> a été relié.</p>
                <p>Votre rôle <strong>${customer.access_level}</strong> a été attribué.</p>
                <p>Vous pouvez fermer cette fenêtre et retourner sur Discord.</p>
            </div>
        `);

    } catch (err) {
        console.error(err);
        res.send(`❌ Erreur d'activation: ${err.message}`);
    }
});

// --- HELPER: ASSIGN ROLE ---
async function assignRole(discordId, accessLevel) {
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        if (!guild) throw new Error("Guild not found");

        let member;
        try {
            member = await guild.members.fetch(discordId);
        } catch (e) {
            console.log(`⚠️ User ${discordId} not in guild. Waiting for them to join.`);
            // Optionally: Send invite link here or store pending role
            return;
        }

        const roleId = ROLES[accessLevel] || ROLES['SOLO']; // Default to SOLO if unknown
        if (!roleId) {
            console.error(`⚠️ No role configured for level ${accessLevel}`);
            return;
        }

        const role = await guild.roles.fetch(roleId);
        if (role && member) {
            await member.roles.add(role);
            console.log(`✅ Role ${role.name} added to ${member.user.tag}`);

            try {
                await member.send(`🎉 Félicitations ! Votre accès **${accessLevel}** est activé sur L'Horizon Crypto.`);
            } catch (e) { /* DM closed */ }
        }
    } catch (err) {
        console.error(`❌ Failed to assign role: ${err.message}`);
    }
}

// --- CRON: EXPIRATION CHECK ---
// Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('⏳ Checking expirations...');

    const now = new Date().toISOString();

    // Select users whose expiration date has passed AND who still have a valid access_level
    const { data: expiredUsers, error } = await supabase
        .from('customers')
        .select('*')
        .lt('expires_at', now)
        .neq('access_level', 'expired') // Only process active ones
        .not('discord_id', 'is', null);

    if (error) {
        return console.error('❌ Cron DB Error:', error);
    }

    if (!expiredUsers || expiredUsers.length === 0) {
        return console.log('✅ No expired users found.');
    }

    console.log(`Found ${expiredUsers.length} expired users.`);

    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);

    for (const user of expiredUsers) {
        try {
            const member = await guild.members.fetch(user.discord_id);
            const roleId = ROLES[user.access_level];

            if (member && roleId) {
                await member.roles.remove(roleId);
                console.log(`🔒 Removed role from ${member.user.tag} (Expired)`);

                try {
                    await member.send("⏳ Votre abonnement L'Horizon Crypto est arrivé à expiration. Renouvelez-le pour retrouver vos accès !");
                } catch (e) { }
            }
        } catch (e) {
            console.error(`⚠️ Could not process user ${user.email}: ${e.message}`);
        }

        // Mark as processed in DB
        await supabase
            .from('customers')
            .update({ access_level: 'expired' })
            .eq('email', user.email);
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
