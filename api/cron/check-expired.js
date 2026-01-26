
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Init Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

const resend = new Resend(process.env.RESEND_API_KEY);
const domain = process.env.DOMAIN || 'https://ebook-horizoncrypto.com';

export default async function handler(req, res) {
    // 1. Security Check (Vercel Cron)
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).end('Unauthorized');
    }

    try {
        console.log('🔄 Cron: Starting daily checks...');
        const now = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(now.getDate() + 3);

        // --- PART A: REMINDERS (Expiring Soon) ---
        console.log('📧 Cron: Checking for reminders...');
        const { data: nearingUsers, error: remindError } = await supabase
            .from('customers')
            .select('*')
            .gt('expires_at', now.toISOString()) // Not yet expired
            .lt('expires_at', threeDaysFromNow.toISOString()) // Expiring within 3 days
            .eq('reminder_sent', false) // Not yet reminded
            .neq('access_level', 'EXPIRED')
            .not('discord_id', 'is', null); // Must be active on Discord

        if (remindError) console.error('Reminder Query Error:', remindError);
        else if (nearingUsers && nearingUsers.length > 0) {
            console.log(`Found ${nearingUsers.length} users to remind.`);

            for (const user of nearingUsers) {
                console.log(`Sending reminder to ${user.email}...`);

                try {
                    await resend.emails.send({
                        from: process.env.FROM_EMAIL || "L'Horizon Crypto <contact@ebook-horizoncrypto.com>",
                        to: user.email,
                        subject: "⏳ Votre accès Discord expire dans 3 jours !",
                        html: `
                            <div style="font-family: Arial, sans-serif; color: #333;">
                                <h2 style="color: #f7931a;">Attention, votre accès se termine bientôt !</h2>
                                <p>Bonjour,</p>
                                <p>Ceci est un petit rappel : votre accès aux salons privés Discord <strong>L'Horizon Crypto</strong> arrive à expiration dans moins de 72 heures.</p>
                                <p>Si vous souhaitez conserver vos avantages (Alertes, Entraide, Lives...), pensez à renouveler votre abonnement dès maintenant.</p>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${domain}/offres.html" style="background-color: #5865F2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                        🔄 Renouveler mon accès
                                    </a>
                                </div>
                                <p style="font-size: 12px; color: #888;">Si vous avez déjà renouvelé, ignorez ce message.</p>
                            </div>
                        `
                    });

                    // Mark as reminded
                    await supabase
                        .from('customers')
                        .update({ reminder_sent: true })
                        .eq('id', user.id);

                } catch (mailError) {
                    console.error(`Failed to send reminder to ${user.email}:`, mailError);
                }
            }
        } else {
            console.log('No users to remind.');
        }

        // --- PART B: EXPIRATION (Already Expired) ---
        console.log('💀 Cron: Checking expired subscriptions...');

        const { data: expiredUsers, error } = await supabase
            .from('customers')
            .select('*')
            .lt('expires_at', now.toISOString())
            .neq('access_level', 'EXPIRED')
            .not('discord_id', 'is', null);

        if (error) throw error;

        console.log(`Found ${expiredUsers.length} expired users.`);

        const results = [];

        for (const user of expiredUsers) {
            console.log(`Processing expiration for ${user.email} (Discord: ${user.discord_id})`);

            const guildId = process.env.DISCORD_GUILD_ID;
            const botToken = process.env.DISCORD_BOT_TOKEN;

            // Determine Role to Remove
            let roleId = process.env.DISCORD_ROLE_MEMBER_ID; // Fallback
            if (user.access_level === 'VIP') roleId = process.env.DISCORD_ROLE_VIP_ID;
            else if (user.access_level === 'PRO') roleId = process.env.DISCORD_ROLE_PRO_ID;
            else if (user.access_level === 'SOLO') roleId = process.env.DISCORD_ROLE_SOLO_ID;
            else if (user.access_level === 'DISCORD') roleId = process.env.DISCORD_ROLE_SOLO_ID; // Assume Discord subscription uses Solo/Member role

            // Remove Role from Discord
            const discordRes = await fetch(`https://discord.com/api/guilds/${guildId}/members/${user.discord_id}/roles/${roleId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bot ${botToken}` }
            });

            if (discordRes.ok || discordRes.status === 404) {
                // 404 means user already left or role already gone, so we consider it "done"

                // Update DB Status
                await supabase
                    .from('customers')
                    .update({ access_level: 'EXPIRED' })
                    .eq('id', user.id);

                results.push({ email: user.email, status: 'removed' });
            } else {
                console.error(`Failed to remove role for ${user.email}: ${discordRes.status}`);
                results.push({ email: user.email, status: 'failed', code: discordRes.status });
            }
        }

        return res.status(200).json({ success: true, processed: results });

    } catch (e) {
        console.error('Cron Error:', e);
        return res.status(500).json({ error: e.message });
    }
}
