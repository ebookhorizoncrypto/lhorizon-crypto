const API_KEY = process.argv[2];
const DOMAIN = 'https://ebook-horizoncrypto.com';
const WEBHOOK_URL = `${DOMAIN}/api/webhook/calendly`;

if (!API_KEY) {
    console.error('❌ Erreur: Veuillez fournir la clé API en argument.');
    console.error('Usage: node scripts/setup-calendly-webhook.js <VOTRE_CLE_API>');
    process.exit(1);
}

async function setup() {
    console.log('🔄 Connexion à Calendly...');

    // 1. Get User URI
    const meRes = await fetch('https://api.calendly.com/users/me', {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });

    if (!meRes.ok) {
        console.error('❌ Impossible de se connecter. Vérifiez votre clé API.');
        const txt = await meRes.text();
        console.error('Détail:', txt);
        return;
    }

    const meData = await meRes.json();
    const userUri = meData.resource.uri;
    const organizationUri = meData.resource.current_organization;
    console.log(`✅ Connecté en tant que: ${meData.resource.name}`);

    // 2. Check existing webhooks
    console.log('🔍 Vérification des webhooks existants...');
    const listRes = await fetch(`https://api.calendly.com/webhook_subscriptions?organization=${organizationUri}&scope=organization`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });

    const listData = await listRes.json();
    const existing = listData.collection.find(w => w.callback_url === WEBHOOK_URL);

    if (existing) {
        console.log('⚠️ Le webhook est DÉJÀ configuré !');
        console.log(`ID: ${existing.uri}`);
        console.log(`Status: ${existing.state}`);
        return;
    }

    // 3. Create Webhook
    console.log(`🚀 Création du webhook vers ${WEBHOOK_URL}...`);
    const createRes = await fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: WEBHOOK_URL,
            events: ['invitee.created', 'invitee.canceled'],
            organization: organizationUri,
            scope: 'organization'
        })
    });

    if (createRes.ok) {
        console.log('✅ SUCCÈS ! Webhook créé et activé.');
        console.log('Les rendez-vous remonteront maintenant automatiquement dans votre Dashboard.');
    } else {
        const errorText = await createRes.text();
        console.error('❌ Erreur lors de la création:', errorText);
        if (errorText.includes('Upgrade')) {
            console.error('👉 NOTE: Les webhooks nécessitent un plan Calendly Standard (Payant).');
        }
    }
}

setup();
