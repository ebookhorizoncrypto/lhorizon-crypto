/* ========================================
   L'HORIZON CRYPTO - Stripe Integration
   Multi-Pack Checkout Redirect
======================================== */

// Configuration des Stripe Payment Links pour chaque pack
const STRIPE_PAYMENT_LINKS = {
    // Stripe Payment Links - Mode Production
    solo: 'https://buy.stripe.com/bJe9AS1BK4ov9jqa6s6wE02',
    pro: 'https://buy.stripe.com/aFa7sK3JS2gngLSemI6wE01',
    vip: 'https://buy.stripe.com/fZu4gydks7AH9jq4M86wE00',
    // Discord Only Subscription (29€/mois)
    discord: 'https://buy.stripe.com/eVqaEW0xG9IP67eemI6wE03'
};

// Configuration générale
const STRIPE_CONFIG = {
    successUrl: window.location.origin + '/merci.html',
    cancelUrl: window.location.origin + '/#pricing'
};

// Initialize Stripe Checkout for all pack buttons
function initStripeCheckout() {
    console.log('💳 Initializing Stripe Checkout...');
    const packButtons = document.querySelectorAll('.btn-pack');

    if (packButtons.length === 0) {
        console.warn('⚠️ No .btn-pack buttons found!');
        return;
    }

    packButtons.forEach(button => {
        // Remove existing listener to avoid duplicates if re-initialized
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('👆 Stripe button clicked');

            // Get pack type
            const card = newButton.closest('.pricing-card');
            const pack = newButton.dataset.pack || card?.dataset.pack || 'solo';
            
            console.log(`📦 Selected Pack: ${pack}`);

            // Show loading state
            const originalHTML = newButton.innerHTML;
            newButton.disabled = true;
            newButton.innerHTML = '<span class="btn-icon">⏳</span> Redirection...';
            newButton.style.cursor = 'wait';

            try {
                const paymentLink = STRIPE_PAYMENT_LINKS[pack];
                
                if (!paymentLink) {
                    throw new Error(`No payment link found for pack: ${pack}`);
                }

                console.log(`🔗 Redirecting to: ${paymentLink}`);

                // Add email param if available
                const email = localStorage.getItem('user_email');
                let finalUrl = paymentLink;
                if (email) {
                    const separator = finalUrl.includes('?') ? '&' : '?';
                    finalUrl += `${separator}prefilled_email=${encodeURIComponent(email)}`;
                }

                // Analytics
                if (typeof trackCheckoutInit === 'function') {
                    trackCheckoutInit(pack, newButton.dataset.price || '0');
                }

                // Direct redirection
                window.location.href = finalUrl;

            } catch (error) {
                console.error('❌ Stripe Error:', error);
                alert('Une erreur est survenue lors de la redirection. Veuillez réessayer.');
                
                // Reset button
                newButton.disabled = false;
                newButton.innerHTML = originalHTML;
                newButton.style.cursor = 'pointer';
            }
        });
    });
    console.log(`✅ Stripe listeners attached to ${packButtons.length} buttons`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStripeCheckout);
} else {
    initStripeCheckout();
}

// Add CSS for modal
const style = document.createElement('style');
style.textContent = `
    .stripe-setup-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    }
    
    .stripe-setup-content {
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 1px solid rgba(247, 147, 26, 0.3);
        border-radius: 16px;
        padding: 40px;
        max-width: 500px;
        width: 100%;
        text-align: center;
        position: relative;
    }
    
    .stripe-setup-close {
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        color: #888;
        font-size: 24px;
        cursor: pointer;
    }
    
    .stripe-setup-close:hover {
        color: #fff;
    }
    
    .stripe-setup-icon {
        font-size: 3rem;
        margin-bottom: 20px;
    }
    
    .stripe-setup-content h3 {
        color: #f7931a;
        margin-bottom: 10px;
        font-size: 1.5rem;
    }
    
    .stripe-setup-content p {
        color: #a0a0b0;
        margin-bottom: 20px;
    }
    
    .stripe-setup-steps {
        text-align: left;
        margin: 20px 0;
    }
    
    .stripe-step {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        color: #fff;
    }
    
    .stripe-step .step-num {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #f7931a, #e68a00);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.9rem;
        color: #000;
        flex-shrink: 0;
    }
    
    .stripe-step a {
        color: #f7931a;
    }
    
    .stripe-setup-code {
        background: rgba(0, 0, 0, 0.3);
        padding: 12px;
        border-radius: 8px;
        margin: 20px 0;
    }
    
    .stripe-setup-code code {
        color: #00ff88;
        font-family: monospace;
        font-size: 0.85rem;
    }
    
    .btn-pack.loading {
        pointer-events: none;
        opacity: 0.7;
    }
    
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1a1a2e;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10001;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s ease;
    }
    
    .notification.show {
        transform: translateY(0);
        opacity: 1;
    }
    
    .notification-error {
        border-color: rgba(255, 71, 87, 0.5);
        background: rgba(255, 71, 87, 0.1);
    }
    
    .notification-success {
        border-color: rgba(0, 255, 136, 0.5);
        background: rgba(0, 255, 136, 0.1);
    }
`;
document.head.appendChild(style);

console.log('💳 Stripe Multi-Pack Integration Loaded - L\'Horizon Crypto');
