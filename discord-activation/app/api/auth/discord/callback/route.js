import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    try {
        // 1. Exchange code for token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/auth/discord/callback`,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('Discord Token Error:', tokenData);
            return NextResponse.json({ error: 'Failed to get Discord token', details: tokenData }, { status: 400 });
        }

        // 2. Get User Info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userResponse.json();

        if (!discordUser.email) {
            return NextResponse.json({ error: "Email not found in Discord profile. Please ensure you share your email." }, { status: 400 });
        }

        // 3. Find Customer in Supabase by Email
        // Check if subscription is valid (expires_at > NOW)
        const { data: customer, error: dbError } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('email', discordUser.email) // Linking by verified email
            .gt('expires_at', new Date().toISOString()) // Must not be expired
            .single();

        if (dbError || !customer) {
            console.log('Customer Lookup Failed:', dbError || 'No active subscription found');
            return NextResponse.json({
                error: 'Aucun abonnement actif trouvé pour cet email.',
                message: `L'email de votre compte Discord (${discordUser.email}) ne correspond à aucun achat actif. Si vous avez utilisé un autre email pour l'achat, merci de contacter le support.`
            }, { status: 404 });
        }

        // 4. Update Supabase with Discord ID
        await supabaseAdmin
            .from('customers')
            .update({ discord_id: discordUser.id })
            .eq('id', customer.id);

        // 5. Assign Role in Discord Guild
        const guildId = process.env.DISCORD_GUILD_ID;
        const botToken = process.env.DISCORD_BOT_TOKEN;

        // Determine Role ID based on access_level
        let roleIdToAdd = process.env.DISCORD_ROLE_MEMBER_ID; // Default
        if (customer.access_level === 'VIP') roleIdToAdd = process.env.DISCORD_ROLE_VIP_ID;
        else if (customer.access_level === 'PRO') roleIdToAdd = process.env.DISCORD_ROLE_PRO_ID;
        else if (customer.access_level === 'SOLO' || customer.access_level === 'DISCORD_ONLY') roleIdToAdd = process.env.DISCORD_ROLE_SOLO_ID;

        // Add Member to Guild (if not already) and Add Role
        // PUT /guilds/{guild.id}/members/{user.id}
        const addRoleResponse = await fetch(`https://discord.com/api/guilds/${guildId}/members/${discordUser.id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: tokenData.access_token, // Needed to add user to guild if not present
                roles: [roleIdToAdd],
            }),
        });

        // If user is already in guild, PUT might return 204 or we might need to PATCH specific roles if just updating
        // Standard approach: PUT to join+role or PATCH to update roles if 204.
        // However, simpler logic: Try to add role specifically if the join PUT didn't cover it fully or if we want to append.
        // The PUT /members/{uid} endpoint with `roles` array replaces roles or adds user with those roles. 
        // SAFEST: Let's do a specific PUT Role endpoint as well to be sure we don't overwrite other roles accidentally if using the join endpoint aggressively.

        // Better Logic: 
        // 1. Try add member (PUT /members/{id}) with access_token.
        // 2. PUT /guilds/{guild.id}/members/{user.id}/roles/{role.id} to ensure specific role is added without touching others.

        await fetch(`https://discord.com/api/guilds/${guildId}/members/${discordUser.id}/roles/${roleIdToAdd}`, {
            method: 'PUT',
            headers: { Authorization: `Bot ${botToken}` }
        });


        // 6. Redirect to Success Page
        // In a real app, you might redirect to a nice success page
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/discord-success.html`); // Assuming you have a static success page or similar

    } catch (error) {
        console.error('Callback Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
