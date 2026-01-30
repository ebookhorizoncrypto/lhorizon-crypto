/**
 * L'Horizon Crypto - Discord Notification Bot
 * 
 * This bot sends alerts to a Discord channel when:
 * 1. New purchase is made (via Stripe webhook)
 * 2. Someone attempts to claim their reward
 * 3. Reward is successfully sent (via smart contract event)
 * 
 * Setup:
 * 1. Create a Discord bot at https://discord.com/developers/applications
 * 2. Add bot to your server with "Send Messages" permission
 * 3. Copy the bot token and channel ID to .env
 * 4. Run: npm install discord.js ethers express
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { ethers } = require('ethers');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const config = {
    discordToken: process.env.DISCORD_BOT_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    baseRpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    contractAddress: process.env.POL_CONTRACT_ADDRESS,
    port: process.env.BOT_PORT || 3001,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    soloRoleId: process.env.ROLE_ID_SOLO || '0',
    proRoleId: process.env.ROLE_ID_PRO || '0',
    vipRoleId: process.env.ROLE_ID_VIP || '0'
};

// Supabase Init
const supabase = createClient(config.supabaseUrl || 'https://placeholder.supabase.co', config.supabaseKey || 'placeholder');

// Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let discordChannel = null;

// Discord Ready Event
client.once('ready', () => {
    console.log(`🤖 Discord Bot ready as ${client.user.tag}`);
    discordChannel = client.channels.cache.get(config.channelId);
    if (!discordChannel) {
        console.error('❌ Channel not found! Check DISCORD_CHANNEL_ID');
    }
});

// Listener for Commands
client.on('messageCreate', async (message) => {
    // Ignore updates from bot
    if (message.author.bot) return;

    // Command !verify <email>
    if (message.content.startsWith('!verify')) {
        const args = message.content.split(' ');
        if (args.length < 2) {
            return message.reply('❌ Usage: `!verify <votre_email>` (ex: `!verify monemail@gmail.com`)');
        }

        const email = args[1].trim().toLowerCase();

        try {
            await message.react('🔄');

            // 1. Check Supabase
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !user) {
                await message.react('❌');
                return message.reply(`❌ Aucun achat trouvé pour l'email **${email}**.\nAssurez-vous d'utiliser l'email de votre commande.`);
            }

            // 2. Determine Role
            let roleId = null;
            let roleName = "";
            let accessLevel = user.access_level || 1; // Default to Solo if not set

            if (accessLevel >= 3) {
                roleId = config.vipRoleId;
                roleName = "VIP";
            } else if (accessLevel === 2) {
                roleId = config.proRoleId;
                roleName = "PRO";
            } else {
                roleId = config.soloRoleId;
                roleName = "SOLO";
            }

            // 3. Update Supabase with Discord ID
            await supabase
                .from('users')
                .update({ discord_id: message.author.id })
                .eq('email', email);

            // 4. Assign Role
            if (roleId && roleId !== '0') {
                const guild = message.guild;
                const role = guild.roles.cache.get(roleId);
                const member = await guild.members.fetch(message.author.id);

                if (role && member) {
                    await member.roles.add(role);
                    await message.react('✅');
                    return message.reply(`✅ Félicitations ! Votre email est vérifié. Vous avez reçu le rôle **${roleName}**.`);
                } else {
                    return message.reply(`⚠️ Email vérifié, mais impossible d'attribuer le rôle (ID ${roleId} introuvable ou permissions insuffisantes). Contactez un admin.`);
                }
            } else {
                return message.reply('⚠️ Verification réussie, mais aucun Role ID n\'est configuré pour ce niveau.');
            }

        } catch (err) {
            console.error(err);
            return message.reply('❌ Une erreur interne est survenue lors de la vérification.');
        }
    }
});

// =====================================
// DISCORD MESSAGE FUNCTIONS
// =====================================

async function sendPurchaseAlert(data) {
    if (!discordChannel) return;

    const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('💰 Nouvel Achat !')
        .setDescription(`Un client vient d'acheter un pack !`)
        .addFields(
            { name: '📧 Email', value: maskEmail(data.email), inline: true },
            { name: '📦 Pack', value: data.pack || 'Solo', inline: true },
            { name: '💵 Montant', value: `${data.amount}€`, inline: true },
            { name: '🕐 Date', value: new Date().toLocaleString('fr-FR'), inline: false }
        )
        .setTimestamp()
        .setFooter({ text: "L'Horizon Crypto - Dashboard" });

    await discordChannel.send({ embeds: [embed] });
}

async function sendClaimAttemptAlert(data) {
    if (!discordChannel) return;

    const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⏳ Tentative de Claim')
        .setDescription(`Un utilisateur tente de réclamer sa récompense`)
        .addFields(
            { name: '📧 Email', value: maskEmail(data.email), inline: true },
            { name: '👛 Wallet', value: shortenAddress(data.wallet), inline: true },
            { name: '🔑 Clés valides', value: data.keysValid ? '✅ Oui' : '❌ Non', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: "L'Horizon Crypto - Claim Monitor" });

    await discordChannel.send({ embeds: [embed] });
}

async function sendClaimSuccessAlert(data) {
    if (!discordChannel) return;

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Récompense Envoyée !')
        .setDescription(`20$ USDC ont été envoyés avec succès !`)
        .addFields(
            { name: '👛 Wallet', value: shortenAddress(data.recipient), inline: true },
            { name: '💵 Montant', value: '20 USDC', inline: true },
            { name: '📋 Transaction', value: `[BaseScan](https://basescan.org/tx/${data.txHash})`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: "L'Horizon Crypto - Blockchain" });

    await discordChannel.send({ embeds: [embed] });
}

async function sendDailySummary() {
    if (!discordChannel) return;

    // Fetch stats from your database/API
    const stats = await fetchDailyStats();

    const embed = new EmbedBuilder()
        .setColor(0x7C3AED)
        .setTitle('📊 Résumé Quotidien')
        .setDescription(`Statistiques du ${new Date().toLocaleDateString('fr-FR')}`)
        .addFields(
            { name: '💰 Ventes du jour', value: `${stats.sales}`, inline: true },
            { name: '💵 Revenu', value: `${stats.revenue}€`, inline: true },
            { name: '🎁 Claims', value: `${stats.claims}`, inline: true },
            { name: '📈 Total clients', value: `${stats.totalCustomers}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: "L'Horizon Crypto - Daily Report" });

    await discordChannel.send({ embeds: [embed] });
}

// =====================================
// HELPER FUNCTIONS
// =====================================

function maskEmail(email) {
    const [name, domain] = email.split('@');
    return `${name.charAt(0)}***@${domain}`;
}

function shortenAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function fetchDailyStats() {
    // TODO: Fetch from your database
    return {
        sales: 0,
        revenue: 0,
        claims: 0,
        totalCustomers: 0
    };
}

// =====================================
// EXPRESS SERVER FOR WEBHOOKS
// =====================================

const app = express();

// Raw body for Stripe signature verification
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

// Stripe Webhook Endpoint
app.post('/webhook/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            await sendPurchaseAlert({
                email: session.customer_email,
                pack: session.metadata?.pack || 'Solo',
                amount: session.amount_total / 100
            });
            break;

        case 'payment_intent.succeeded':
            console.log('Payment succeeded:', event.data.object.id);
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

// Claim Attempt Endpoint (called from your backend)
app.post('/alert/claim-attempt', async (req, res) => {
    const { email, wallet, keysValid } = req.body;

    await sendClaimAttemptAlert({ email, wallet, keysValid });

    res.json({ success: true });
});

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        discord: client.isReady() ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

// =====================================
// BLOCKCHAIN EVENT LISTENER
// =====================================

async function startBlockchainListener() {
    if (!config.contractAddress) {
        console.log('⚠️ No contract address configured. Skipping blockchain listener.');
        return;
    }

    const provider = new ethers.JsonRpcProvider(config.baseRpcUrl);

    const contractABI = [
        "event ClaimProcessed(address indexed recipient, bytes32 indexed emailHash, uint256 amount, uint256 timestamp)"
    ];

    const contract = new ethers.Contract(config.contractAddress, contractABI, provider);

    contract.on('ClaimProcessed', async (recipient, emailHash, amount, timestamp, event) => {
        console.log('🎁 ClaimProcessed event detected!');
        await sendClaimSuccessAlert({
            recipient,
            amount: ethers.formatUnits(amount, 6),
            txHash: event.log.transactionHash
        });
    });

    console.log('🔗 Blockchain event listener started');
}

// =====================================
// SCHEDULED TASKS
// =====================================

function scheduleDailySummary() {
    // Send daily summary at 20:00 Paris time
    const now = new Date();
    const target = new Date();
    target.setHours(20, 0, 0, 0);

    if (now > target) {
        target.setDate(target.getDate() + 1);
    }

    const delay = target - now;

    setTimeout(() => {
        sendDailySummary();
        // Reschedule for next day
        setInterval(sendDailySummary, 24 * 60 * 60 * 1000);
    }, delay);

    console.log(`📅 Daily summary scheduled for ${target.toLocaleString('fr-FR')}`);
}

// =====================================
// START BOT
// =====================================

async function start() {
    // Login to Discord
    await client.login(config.discordToken);

    // Start Express server
    app.listen(config.port, () => {
        console.log(`🚀 Webhook server running on port ${config.port}`);
    });

    // Start blockchain listener
    await startBlockchainListener();

    // Schedule daily summary
    scheduleDailySummary();
}

start().catch(console.error);

module.exports = { sendPurchaseAlert, sendClaimAttemptAlert, sendClaimSuccessAlert };
