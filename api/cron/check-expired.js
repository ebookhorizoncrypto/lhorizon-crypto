
import { createClient } from '@supabase/supabase-js';

// Init Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

export default async function handler(req, res) {
    // 1. Security Check (Vercel Cron)
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).end('Unauthorized');
    }

    try {
        console.log('🔄 Cron: Checking expired subscriptions...');

        // 2. Query Expired Users
        const now = new Date().toISOString();
        const { data: expiredUsers, error } = await supabase
            .from('customers')
            .select('*')
            .lt('expires_at', now)
            .neq('access_level', 'EXPIRED')
            .not('discord_id', 'is', null);

        if (error) throw error;

        console.log(`Found ${expiredUsers.length} expired users.`);

        const results = [];

        // 3. Process Each User
        for (const user of expiredUsers) {
            console.log(`Processing expiration for ${user.email} (Discord: ${user.discord_id})`);

            const guildId = process.env.DISCORD_GUILD_ID;
            const botToken = process.env.DISCORD_BOT_TOKEN;

            // Determine Role to Remove
            let roleId = process.env.DISCORD_ROLE_MEMBER_ID; // Fallback
            if (user.access_level === 'VIP') roleId = process.env.DISCORD_ROLE_VIP_ID;
            else if (user.access_level === 'PRO') roleId = process.env.DISCORD_ROLE_PRO_ID;
            else if (user.access_level === 'SOLO') roleId = process.env.DISCORD_ROLE_SOLO_ID;

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
