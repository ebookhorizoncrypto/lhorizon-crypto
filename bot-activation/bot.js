require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const axios = require('axios');
const crypto = require('crypto');
const Stripe = require('stripe');

// ═══════════════════════════════════════════════════════════════
//                        CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;

// Discord
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_INVITE_URL = process.env.DISCORD_INVITE_URL; // Lien d'invitation au serveur

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Clé pour signer les states OAuth (sécurité)
const STATE_SECRET = process.env.STATE_SECRET || crypto.randomBytes(32).toString('hex');

// Mapping Produits Stripe → Access Level
const PRODUCT_TO_ACCESS = {
    // Ebooks
    'prod_ToX88YPUxtoqez': 'SOLO',   // Ebook Pack Solo
    'prod_ToXf1kpTDB7uNv': 'PRO',    // Ebook Pack Pro
    'prod_ToXtEbkLoqh9iA': 'VIP',    // Ebook Pack VIP
    // Abonnements
    'prod_TpcMzVxIVuGaMa': 'SOLO',   // Abonnement 1 mois
    'prod_ToXr1gq3YcBORK': 'PRO',    // Abonnement 3 mois
    'prod_ToXwVbu17edNfs': 'VIP',    // Abonnement 6 mois
};

// Mapping Access Level → Durée (en jours)
const ACCESS_DURATION = {
    'SOLO': 30,   // 1 mois
    'PRO': 90,    // 3 mois
    'VIP': 180,   // 6 mois
};

// Mapping Access Level → Role ID
const ROLES = {
    'SOLO': process.env.ROLE_ID_SOLO,
    'PRO': process.env.ROLE_ID_PRO,
    'VIP': process.env.ROLE_ID_VIP,
};

// ═══════════════════════════════════════════════════════════════
//                      INITIALISATION
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const app = express();

// Important: Stripe webhook a besoin du raw body
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
//                       DISCORD BOT
// ═══════════════════════════════════════════════════════════════

client.once('ready', () => {
    console.log(`🤖 Bot connecté: ${client.user.tag}`);
    client.user.setActivity('les activations', { type: 3 }); // "Regarde les activations"
});

client.login(DISCORD_BOT_TOKEN);

// ═══════════════════════════════════════════════════════════════
//                    FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════

/**
 * Génère un state sécurisé pour OAuth
 */
function generateState(email) {
    const data = JSON.stringify({ email, timestamp: Date.now() });
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(STATE_SECRET.slice(0, 32)), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Décode un state OAuth
 */
function decodeState(state) {
    try {
        const [ivHex, encrypted] = state.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(STATE_SECRET.slice(0, 32)), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        const data = JSON.parse(decrypted);
        
        // Vérifie que le state n'est pas trop vieux (1 heure max)
        if (Date.now() - data.timestamp > 3600000) {
            return null;
        }
        return data.email;
    } catch (e) {
        console.error('❌ Erreur décodage state:', e.message);
        return null;
    }
}

/**
 * Calcule la date d'expiration
 */
function calculateExpiration(accessLevel) {
    const days = ACCESS_DURATION[accessLevel] || 30;
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + days);
    return expiration.toISOString();
}

/**
 * Attribue un rôle à un membre Discord
 */
async function assignRole(discordId, accessLevel) {
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        if (!guild) throw new Error("Serveur non trouvé");

        let member;
        try {
            member = await guild.members.fetch(discordId);
        } catch (e) {
            console.log(`⚠️ Utilisateur ${discordId} pas encore sur le serveur`);
            return { success: false, reason: 'not_in_guild' };
        }

        const roleId = ROLES[accessLevel];
        if (!roleId) {
            console.error(`⚠️ Pas de rôle configuré pour ${accessLevel}`);
            return { success: false, reason: 'no_role_configured' };
        }

        // Retire les autres rôles d'abonnement d'abord
        for (const [level, rId] of Object.entries(ROLES)) {
            if (rId && member.roles.cache.has(rId)) {
                await member.roles.remove(rId);
                console.log(`🔄 Rôle ${level} retiré de ${member.user.tag}`);
            }
        }

        // Attribue le nouveau rôle
        const role = await guild.roles.fetch(roleId);
        if (role) {
            await member.roles.add(role);
            console.log(`✅ Rôle ${role.name} attribué à ${member.user.tag}`);

            // DM de confirmation
            try {
                const embed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('🎉 Activation Réussie !')
                    .setDescription(`Votre accès **${accessLevel}** est maintenant actif sur L'Horizon.`)
                    .setTimestamp();
                await member.send({ embeds: [embed] });
            } catch (e) { /* DM fermés */ }

            return { success: true };
        }
    } catch (err) {
        console.error(`❌ Erreur attribution rôle: ${err.message}`);
        return { success: false, reason: err.message };
    }
}

/**
 * Retire un rôle à un membre Discord
 */
async function removeRole(discordId, accessLevel) {
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        const member = await guild.members.fetch(discordId);
        const roleId = ROLES[accessLevel];

        if (member && roleId && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            console.log(`🔒 Rôle ${accessLevel} retiré de ${member.user.tag}`);

            // DM d'expiration
            try {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('⏳ Abonnement Expiré')
                    .setDescription(`Votre accès **${accessLevel}** sur L'Horizon est arrivé à expiration.\n\nRenouvelez votre abonnement pour retrouver vos accès !`)
                    .setTimestamp();
                await member.send({ embeds: [embed] });
            } catch (e) { /* DM fermés */ }

            return true;
        }
    } catch (err) {
        console.error(`❌ Erreur retrait rôle: ${err.message}`);
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════
//                      ROUTES EXPRESS
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        bot: client.user?.tag || 'connecting...',
        timestamp: new Date().toISOString()
    });
});

// ─────────────────────────────────────────────────────────────────
//                    OAUTH DISCORD
// ─────────────────────────────────────────────────────────────────

// Route d'activation (appelée depuis l'email)
app.get('/activate', (req, res) => {
    const email = req.query.email;
    if (!email) {
        return res.status(400).send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #ff6b6b;">❌ Erreur</h1>
                <p>Lien d'activation invalide. Email manquant.</p>
            </div>
        `);
    }

    // Génère un state sécurisé
    const state = generateState(email);

    // URL OAuth Discord
    const authUrl = `https://discord.com/api/oauth2/authorize?` +
        `client_id=${DISCORD_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=identify` +
        `&state=${encodeURIComponent(state)}`;

    res.redirect(authUrl);
});

// Callback OAuth Discord
app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
        return res.status(400).send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #ff6b6b;">❌ Erreur</h1>
                <p>Paramètres invalides.</p>
            </div>
        `);
    }

    try {
        // Décode et vérifie le state
        const email = decodeState(state);
        if (!email) {
            return res.status(400).send(`
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #ff6b6b;">❌ Lien Expiré</h1>
                    <p>Ce lien d'activation a expiré. Veuillez utiliser un nouveau lien.</p>
                </div>
            `);
        }

        // Échange le code contre un token
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: DISCORD_REDIRECT_URI
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data.access_token;

        // Récupère les infos Discord de l'utilisateur
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const discordUser = userResponse.data;
        const discordId = discordUser.id;

        console.log(`🔗 Liaison: ${email} → Discord ${discordUser.username} (${discordId})`);

        // Vérifie si le customer existe dans Supabase
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();

        if (fetchError || !customer) {
            return res.status(404).send(`
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #ff6b6b;">❌ Achat Non Trouvé</h1>
                    <p>Aucun achat trouvé pour <strong>${email}</strong>.</p>
                    <p>Vérifiez que vous utilisez la même adresse email que lors du paiement.</p>
                </div>
            `);
        }

        // Met à jour le discord_id dans Supabase
        const { error: updateError } = await supabase
            .from('customers')
            .update({ 
                discord_id: discordId
            })
            .eq('email', email.toLowerCase());

        if (updateError) {
            console.error('❌ Erreur Supabase:', updateError);
            return res.status(500).send(`
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #ff6b6b;">❌ Erreur</h1>
                    <p>Erreur lors de la sauvegarde. Réessayez.</p>
                </div>
            `);
        }

        // Attribue le rôle
        const roleResult = await assignRole(discordId, customer.access_level);

        // Page de succès
        const successHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Activation Réussie - L'Horizon</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', sans-serif;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                    }
                    .container {
                        background: rgba(255,255,255,0.05);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 50px;
                        text-align: center;
                        max-width: 500px;
                        border: 1px solid rgba(255,255,255,0.1);
                    }
                    .success-icon {
                        font-size: 80px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #00ff88;
                        margin-bottom: 20px;
                    }
                    .user-info {
                        background: rgba(0,255,136,0.1);
                        border-radius: 10px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .user-info p {
                        margin: 10px 0;
                    }
                    .role-badge {
                        display: inline-block;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 8px 20px;
                        border-radius: 20px;
                        font-weight: bold;
                        margin-top: 10px;
                    }
                    .discord-btn {
                        display: inline-block;
                        background: #5865F2;
                        color: white;
                        padding: 15px 30px;
                        border-radius: 10px;
                        text-decoration: none;
                        font-weight: bold;
                        margin-top: 20px;
                        transition: transform 0.2s;
                    }
                    .discord-btn:hover {
                        transform: scale(1.05);
                    }
                    .note {
                        color: #888;
                        font-size: 14px;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✅</div>
                    <h1>Activation Réussie !</h1>
                    
                    <div class="user-info">
                        <p>👤 <strong>${discordUser.username}</strong></p>
                        <p>📧 ${email}</p>
                        <div class="role-badge">🎖️ ${customer.access_level}</div>
                    </div>
                    
                    ${roleResult.success 
                        ? '<p>Votre rôle a été attribué automatiquement !</p>' 
                        : `<p>⚠️ Rejoignez le serveur pour recevoir votre rôle.</p>`
                    }
                    
                    <a href="${DISCORD_INVITE_URL || 'https://discord.gg/votre-serveur'}" class="discord-btn">
                        Accéder au Discord
                    </a>
                    
                    <p class="note">Vous pouvez fermer cette page.</p>
                </div>
            </body>
            </html>
        `;

        res.send(successHtml);

    } catch (err) {
        console.error('❌ Erreur OAuth:', err);
        res.status(500).send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #ff6b6b;">❌ Erreur</h1>
                <p>${err.message}</p>
            </div>
        `);
    }
});

// ─────────────────────────────────────────────────────────────────
//                    WEBHOOK STRIPE
// ─────────────────────────────────────────────────────────────────

app.post('/webhook/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('❌ Webhook signature invalide:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`📩 Webhook Stripe: ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionCancelled(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;
        }
    } catch (err) {
        console.error(`❌ Erreur traitement webhook: ${err.message}`);
    }

    res.json({ received: true });
});

/**
 * Gère un checkout complété
 */
async function handleCheckoutCompleted(session) {
    const email = session.customer_email || session.customer_details?.email;
    if (!email) {
        console.error('❌ Email non trouvé dans le checkout');
        return;
    }

    console.log(`💰 Checkout complété: ${email}`);

    try {
        // ✅ CORRECTION: "sessions" en minuscule
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        
        for (const item of lineItems.data) {
            const productId = item.price?.product;
            const accessLevel = PRODUCT_TO_ACCESS[productId];
            const amountPaid = item.amount_total ? item.amount_total / 100 : null; // Stripe donne en centimes
            
            if (accessLevel) {
                const expiresAt = calculateExpiration(accessLevel);

                // Upsert dans Supabase (adapté à ta structure)
                const { error } = await supabase
                    .from('customers')
                    .upsert({
                        email: email.toLowerCase(),
                        stripe_customer_id: session.customer,
                        access_level: accessLevel,
                        amount_paid: amountPaid,
                        expires_at: expiresAt,
                        reminder_sent: false,
                        claimed: false
                    }, {
                        onConflict: 'email'
                    });

                if (error) {
                    console.error('❌ Erreur Supabase:', error);
                } else {
                    console.log(`✅ Customer créé/mis à jour: ${email} → ${accessLevel} (${amountPaid}€)`);
                }

                // Si le discord_id existe déjà, attribue le rôle
                const { data: customer } = await supabase
                    .from('customers')
                    .select('discord_id')
                    .eq('email', email.toLowerCase())
                    .single();

                if (customer?.discord_id) {
                    await assignRole(customer.discord_id, accessLevel);
                }
            } else {
                console.log(`⚠️ Product ID non mappé: ${productId}`);
            }
        }
    } catch (err) {
        console.error('❌ Erreur traitement checkout:', err.message);
    }
}

/**
 * Gère une mise à jour d'abonnement
 */
async function handleSubscriptionUpdate(subscription) {
    const customerId = subscription.customer;
    
    try {
        const customer = await stripe.customers.retrieve(customerId);
        const email = customer.email;
        
        if (!email) return;

        const productId = subscription.items?.data[0]?.price?.product;
        const accessLevel = PRODUCT_TO_ACCESS[productId];

        if (accessLevel) {
            // ✅ CORRECTION: Vérifie que current_period_end existe
            let expiresAt;
            if (subscription.current_period_end) {
                expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
            } else {
                expiresAt = calculateExpiration(accessLevel);
            }

            // Upsert pour créer si n'existe pas
            const { error } = await supabase
                .from('customers')
                .upsert({
                    email: email.toLowerCase(),
                    stripe_customer_id: customerId,
                    access_level: accessLevel,
                    expires_at: expiresAt,
                    reminder_sent: false
                }, {
                    onConflict: 'email'
                });

            if (error) {
                console.error('❌ Erreur Supabase:', error);
            } else {
                console.log(`🔄 Abonnement mis à jour: ${email} → ${accessLevel} (expire: ${expiresAt})`);
            }

            // Attribue le rôle si discord_id existe
            const { data: dbCustomer } = await supabase
                .from('customers')
                .select('discord_id')
                .eq('email', email.toLowerCase())
                .single();

            if (dbCustomer?.discord_id) {
                await assignRole(dbCustomer.discord_id, accessLevel);
            }
        } else {
            console.log(`⚠️ Product ID non mappé: ${productId}`);
        }
    } catch (err) {
        console.error('❌ Erreur handleSubscriptionUpdate:', err.message);
    }
}

/**
 * Gère une annulation d'abonnement
 */
async function handleSubscriptionCancelled(subscription) {
    const customerId = subscription.customer;
    
    try {
        const customer = await stripe.customers.retrieve(customerId);
        const email = customer.email;
        
        if (!email) return;

        const { data: dbCustomer } = await supabase
            .from('customers')
            .select('discord_id, access_level')
            .eq('email', email.toLowerCase())
            .single();

        if (dbCustomer?.discord_id && dbCustomer?.access_level) {
            await removeRole(dbCustomer.discord_id, dbCustomer.access_level);
        }

        await supabase
            .from('customers')
            .update({
                access_level: 'expired'
            })
            .eq('email', email.toLowerCase());

        console.log(`❌ Abonnement annulé: ${email}`);

    } catch (err) {
        console.error('❌ Erreur handleSubscriptionCancelled:', err.message);
    }
}

/**
 * Gère un paiement réussi (renouvellement)
 */
async function handlePaymentSucceeded(invoice) {
    const email = invoice.customer_email;
    if (!email) return;

    console.log(`💳 Paiement réussi: ${email}`);

    // Le rôle sera mis à jour via handleSubscriptionUpdate
}

/**
 * Gère un paiement échoué
 */
async function handlePaymentFailed(invoice) {
    const email = invoice.customer_email;
    if (!email) return;

    console.log(`⚠️ Paiement échoué: ${email}`);

    // Optionnel: envoyer un DM d'avertissement
    const { data: customer } = await supabase
        .from('customers')
        .select('discord_id')
        .eq('email', email.toLowerCase())
        .single();

    if (customer?.discord_id) {
        try {
            const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
            const member = await guild.members.fetch(customer.discord_id);
            
            const embed = new EmbedBuilder()
                .setColor('#ff9500')
                .setTitle('⚠️ Problème de Paiement')
                .setDescription('Votre dernier paiement a échoué. Veuillez mettre à jour votre moyen de paiement pour éviter l\'interruption de votre accès.')
                .setTimestamp();
            
            await member.send({ embeds: [embed] });
        } catch (e) { /* DM fermés ou membre pas trouvé */ }
    }
}

// ─────────────────────────────────────────────────────────────────
//                    CRON: VÉRIFICATION EXPIRATIONS
// ─────────────────────────────────────────────────────────────────

// Toutes les heures
cron.schedule('0 * * * *', async () => {
    console.log('⏳ Vérification des expirations...');

    const now = new Date().toISOString();

    const { data: expiredUsers, error } = await supabase
        .from('customers')
        .select('*')
        .lt('expires_at', now)
        .not('access_level', 'eq', 'expired')
        .not('discord_id', 'is', null);

    if (error) {
        console.error('❌ Erreur cron:', error);
        return;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
        console.log('✅ Aucun abonnement expiré');
        return;
    }

    console.log(`📋 ${expiredUsers.length} abonnement(s) expiré(s) trouvé(s)`);

    for (const user of expiredUsers) {
        try {
            // Retire le rôle
            await removeRole(user.discord_id, user.access_level);

            // Met à jour Supabase
            await supabase
                .from('customers')
                .update({ 
                    access_level: 'expired'
                })
                .eq('email', user.email);

            console.log(`✅ Expiration traitée: ${user.email}`);

        } catch (err) {
            console.error(`❌ Erreur traitement ${user.email}:`, err.message);
        }
    }
});

// ─────────────────────────────────────────────────────────────────
//                    CRON: RAPPEL AVANT EXPIRATION (3 jours)
// ─────────────────────────────────────────────────────────────────

cron.schedule('0 9 * * *', async () => { // Tous les jours à 9h
    console.log('📬 Vérification des rappels...');

    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);

    const { data: soonExpiring, error } = await supabase
        .from('customers')
        .select('*')
        .lt('expires_at', inThreeDays.toISOString())
        .gt('expires_at', new Date().toISOString())
        .eq('reminder_sent', false)
        .not('discord_id', 'is', null);

    if (error || !soonExpiring || soonExpiring.length === 0) return;

    console.log(`📋 ${soonExpiring.length} rappel(s) à envoyer`);

    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);

    for (const user of soonExpiring) {
        try {
            const member = await guild.members.fetch(user.discord_id);
            
            const embed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('⏰ Rappel - Abonnement bientôt expiré')
                .setDescription(`Votre accès **${user.access_level}** expire dans moins de 3 jours.\n\nRenouvelez maintenant pour ne pas perdre vos accès !`)
                .setTimestamp();
            
            await member.send({ embeds: [embed] });

            // Marque comme envoyé
            await supabase
                .from('customers')
                .update({ reminder_sent: true })
                .eq('email', user.email);

            console.log(`📬 Rappel envoyé à ${user.email}`);

        } catch (e) {
            console.error(`⚠️ Rappel échoué pour ${user.email}:`, e.message);
        }
    }
});

// ─────────────────────────────────────────────────────────────────
//                    CRON: ATTRIBUTION RÔLES EN ATTENTE
// ─────────────────────────────────────────────────────────────────

// Toutes les 5 minutes: vérifie si des users ont rejoint le serveur
cron.schedule('*/5 * * * *', async () => {
    const { data: pendingUsers, error } = await supabase
        .from('customers')
        .select('*')
        .not('discord_id', 'is', null)
        .not('access_level', 'eq', 'expired')
        .gt('expires_at', new Date().toISOString());

    if (error || !pendingUsers || pendingUsers.length === 0) return;

    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);

    for (const user of pendingUsers) {
        try {
            const member = await guild.members.fetch(user.discord_id);
            if (member) {
                const roleId = ROLES[user.access_level];
                if (roleId && !member.roles.cache.has(roleId)) {
                    await assignRole(user.discord_id, user.access_level);
                }
            }
        } catch (e) {
            // Membre pas encore sur le serveur
        }
    }
});

// ═══════════════════════════════════════════════════════════════
//                       DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📍 Routes disponibles:`);
    console.log(`   GET  /              → Health check`);
    console.log(`   GET  /activate      → Début OAuth Discord`);
    console.log(`   GET  /auth/discord/callback → Callback OAuth`);
    console.log(`   POST /webhook/stripe → Webhook Stripe`);
});
