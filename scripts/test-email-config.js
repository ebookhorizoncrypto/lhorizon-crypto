import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

async function testConfig() {
    console.log('🔍 Starting Configuration Diagnostic...');

    // 1. Check Environment Variables
    const keysToCheck = [
        { key: 'RESEND_API_KEY', placeholder: 're_' },
        { key: 'STRIPE_WEBHOOK_SECRET', placeholder: 'whsec_VOTRE' },
        { key: 'STRIPE_SECRET_KEY', placeholder: 'sk_live_VOTRE' },
        { key: 'FROM_EMAIL', placeholder: 'contact@' }
    ];

    let hasPlaceholders = false;
    keysToCheck.forEach(({ key, placeholder }) => {
        const value = process.env[key];
        if (!value) {
            console.error(`❌ Missing variable: ${key}`);
        } else if (value.includes('VOTRE_') || value === placeholder) {
            console.warn(`⚠️ Potentially invalid placeholder in ${key}: ${value}`);
            hasPlaceholders = true;
        } else {
            console.log(`✅ ${key} is set (Length: ${value.length})`);
        }
    });

    if (hasPlaceholders) {
        console.warn('\n⚠️ WARNING: Some Stripe keys appear to be placeholders. Webhooks will fail signature verification.');
    }

    // 2. Test Email Sending
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || resendApiKey.includes('VOTRE')) {
        console.error('❌ Cannot test email: RESEND_API_KEY is missing or invalid.');
        return;
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    const testToEmail = 'delivered@resend.dev'; // Safe test address

    console.log(`\n📧 Attempting to send test email...`);
    console.log(`From: ${fromEmail}`);
    console.log(`To: ${testToEmail}`);

    try {
        const data = await resend.emails.send({
            from: fromEmail,
            to: testToEmail,
            subject: 'Diagnostic Test - Horizon Crypto',
            html: '<p>This is a test email from the diagnostic script.</p>'
        });

        if (data.error) {
            console.error('❌ Email sending failed:', data.error);
        } else {
            console.log('✅ Email sent successfully!', data);
        }
    } catch (error) {
        console.error('❌ Exception during email sending:', error.message);
    }
}

testConfig();
