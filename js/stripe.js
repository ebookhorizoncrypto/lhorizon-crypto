/* ========================================
   L'HORIZON CRYPTO - Stripe Integration (Robust Version)
   Multi-Pack Checkout Redirect
======================================== */

// Configuration des Stripe Payment Links
// ====== LIENS LIVE (PRODUCTION) - Ne pas supprimer ======
// solo: 'https://buy.stripe.com/bJe9AS1BK4ov9jqa6s6wE02',
// pro: 'https://buy.stripe.com/6oUcN4a8gaMTcvC1zW6wE05',
// vip: 'https://buy.stripe.com/aFaaEW1BKaMT1QY2E06wE04',
// discord: 'https://buy.stripe.com/eVqaEW0xG9IP67eemI6wE03'
// =========================================================

// ====== LIENS TEST (pour tester avant déploiement) ======
const STRIPE_PAYMENT_LINKS = {
    solo: 'https://buy.stripe.com/test_eVq7sNe9T6ZN3v318U2wU00',
    pro: 'https://buy.stripe.com/test_28E7sN3vf2Jx9TrdVG2wU01',
    vip: 'https://buy.stripe.com/test_7sY00l4zjfwj7Lj6te2wU02',
    discord: 'https://buy.stripe.com/eVqaEW0xG9IP67eemI6wE03' // Pas de lien test fourni, garde le live
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('💳 Stripe Integration Loaded (Delegation Mode)');

    // Use Event Delegation to catch clicks on any .btn-pack, present or future
    document.body.addEventListener('click', handleStripeClick, true); // Use capture phase for priority
});

function handleStripeClick(e) {
    // Traverse up from the target to find the button
    const button = e.target.closest('.btn-pack');

    if (!button) return; // Not a pack button

    // Check if this button has a custom upsell handler (local override)
    if (button.dataset.upsell === 'true') {
        console.log('↩️ Skipping global Stripe handler for Upsell button');
        return;
    }

    // Stop other handlers (optional, but safer)
    e.preventDefault();
    e.stopPropagation();

    console.log('👆 Stripe Button Clicked:', button);

    // Get pack type
    // Priority: data-pack on button > data-pack on card > 'solo' default
    let pack = button.dataset.pack;

    if (!pack) {
        const card = button.closest('.pricing-card') || button.closest('.discord-subscription-card');
        if (card) {
            pack = card.dataset.pack;
        }
    }

    if (!pack) {
        // Fallback checks based on text content if data attributes fail
        const text = button.innerText.toLowerCase();
        if (text.includes('vip')) pack = 'vip';
        else if (text.includes('pro')) pack = 'pro';
        else if (text.includes('discord')) pack = 'discord';
        else pack = 'solo';
    }

    console.log(`📦 Identified Pack: ${pack}`);

    const link = STRIPE_PAYMENT_LINKS[pack];

    if (link) {
        // Add visual feedback
        const originalText = button.innerHTML;
        button.innerHTML = '⏳ Redirection...';
        button.style.cursor = 'wait';
        button.disabled = true;

        // Add email if stored
        const email = localStorage.getItem('user_email');
        const finalUrl = email
            ? `${link}?prefilled_email=${encodeURIComponent(email)}`
            : link;

        console.log(`🔗 Redirecting to: ${finalUrl}`);

        // Force redirect
        window.location.href = finalUrl;
    } else {
        console.error('❌ No link found for pack:', pack);
        // Fallback safety
        if (pack === 'solo') window.location.href = STRIPE_PAYMENT_LINKS.solo;
        else alert('Erreur de lien. Contactez le support sur Discord.');
    }
}
