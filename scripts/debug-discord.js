import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local manually since dotenv default only loads .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config(); // fallback
}

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const TARGET_USER_ID = process.argv[2];

async function debugDiscord() {
    console.log('🔍 Starting Discord Debugger...');
    console.log('--------------------------------');

    if (!BOT_TOKEN) {
        console.error('❌ Missing DISCORD_BOT_TOKEN in .env.local');
        return;
    }

    // 1. Get Bot Info & Guilds
    console.log(`\n📡 Authenticating as Bot...`);
    const meRes = await fetch(`https://discord.com/api/users/@me`, {
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });

    if (!meRes.ok) {
        console.error(`❌ Auth Failed: ${meRes.status}`);
        return;
    }
    const me = await meRes.json();
    console.log(`✅ Authenticated as: ${me.username}#${me.discriminator} (ID: ${me.id})`);

    // Fetch Guilds
    console.log('\n🔍 Finding Guilds...');
    const guildsRes = await fetch(`https://discord.com/api/users/@me/guilds`, {
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const guilds = await guildsRes.json();

    if (guilds.length === 0) {
        console.error('❌ Bot is not in any guilds! Invite it first.');
        return;
    }

    const guild = guilds[0]; // Assuming mainly one guild for this project
    const GUILD_ID = guild.id;
    console.log(`✅ Found Guild: "${guild.name}" (ID: ${GUILD_ID})`);

    // 2. Fetch Roles & Hierarchy
    console.log('\n🎭 Analyzing Role Hierarchy...');
    const rolesRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/roles`, {
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const roles = await rolesRes.json();

    // Sort roles by position (descending)
    roles.sort((a, b) => b.position - a.position);

    const botMemberRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${me.id}`, {
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
    });
    const botMember = await botMemberRes.json();

    // Find Bot's Highest Role
    let highestBotRolePos = 0;
    botMember.roles.forEach(rId => {
        const r = roles.find(gx => gx.id === rId);
        if (r && r.position > highestBotRolePos) highestBotRolePos = r.position;
    });

    console.log(`\n📊 Hierarchy (Highest to Lowest):`);
    console.log(`   (Bot's Highest Level: ${highestBotRolePos})`);

    const roleMap = {};

    roles.forEach(r => {
        const isBotRole = botMember.roles.includes(r.id);
        const canManage = highestBotRolePos > r.position;
        const status = isBotRole ? '🤖 BOT' : (canManage ? '✅ MANAGEABLE' : '❌ TOO HIGH');

        console.log(`   [${r.position}] ${r.name} (${status}) - ID: ${r.id}`);

        // Identify potential product roles by name
        if (r.name.toLowerCase().includes('solo')) roleMap.SOLO = r.id;
        if (r.name.toLowerCase().includes('pro')) roleMap.PRO = r.id;
        if (r.name.toLowerCase().includes('vip')) roleMap.VIP = r.id;
        if (r.name.toLowerCase().includes('membre')) roleMap.MEMBER = r.id;
    });

    // 3. Attempt Assignment
    if (TARGET_USER_ID) {
        console.log(`\n👤 Testing Assignment for User: ${TARGET_USER_ID}`);

        // Try assigning SOLO role primarily, or whatever we found
        const targetRoleId = roleMap.SOLO || roleMap.PRO || roleMap.VIP || roles.find(r => r.name !== '@everyone').id;

        if (!targetRoleId) {
            console.error('❌ Could not identify a target role to assign.');
            return;
        }

        const targetRole = roles.find(r => r.id === targetRoleId);
        console.log(`   Target Role: "${targetRole.name}" (ID: ${targetRoleId})`);

        if (highestBotRolePos <= targetRole.position) {
            console.error(`❌ CRITICAL: Bot cannot assign "${targetRole.name}" because it is higher or equal in hierarchy.`);
            console.error(`   Bot Level: ${highestBotRolePos} | Role Level: ${targetRole.position}`);
            console.error(`   👉 FIX: Go to Server Settings > Roles, drag the Bot's role ABOVE "${targetRole.name}".`);
            return;
        }

        console.log(`   Attempting add...`);
        const assignRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${TARGET_USER_ID}/roles/${targetRoleId}`, {
            method: 'PUT',
            headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });

        if (assignRes.ok || assignRes.status === 204) {
            console.log('✅ SUCCESS! Role assigned. Hierarchy is good.');
        } else {
            console.error(`❌ FAILED: ${assignRes.status} ${assignRes.statusText}`);
            console.error(await assignRes.text());
        }
    } else {
        console.log('\nℹ️  Run with User ID to test assignment.');
    }
}

debugDiscord();
