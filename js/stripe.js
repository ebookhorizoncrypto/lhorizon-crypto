/* ========================================
   L'HORIZON CRYPTO - Stripe Integration
   Multi-Pack Checkout Redirect
======================================== */

// Configuration des Stripe Payment Links pour chaque pack
const STRIPE_PAYMENT_LINKS = {
    // Remplacez ces URLs par vos vrais Payment Links Stripe
    solo: 'https://buy.stripe.com/VOTRE_LIEN_SOLO',
    pro: 'https://buy.stripe.com/VOTRE_LIEN_PRO',
    vip: 'https://buy.stripe.com/VOTRE_LIEN_VIP'
};

// Configuration générale
const STRIPE_CONFIG = {
    successUrl: window.location.origin + '/merci.html',
    cancelUrl: window.location.origin + '/#pricing'
};

// Initialize Stripe Checkout for all pack buttons
function initStripeCheckout() {
    const packButtons = document.querySelectorAll('.btn-pack');

    packButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();

            // Get pack type from parent card
            const card = button.closest('.pricing-card');
            const pack = card?.dataset.pack || 'solo';
            const price = button.dataset.price || '99';

            // Show loading state
            const originalHTML = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<span class="btn-icon">⏳</span> Redirection...';
            button.classList.add('loading');

            try {
                // Check if Payment Link is configured
                const paymentLink = STRIPE_PAYMENT_LINKS[pack];

                if (paymentLink && !paymentLink.includes('VOTRE_LIEN')) {
                    // Add email parameter if available
                    const email = localStorage.getItem('user_email');
                    let redirectUrl = paymentLink;

                    if (email) {
                        redirectUrl += `?prefilled_email=${encodeURIComponent(email)}`;
                    }

                    // Track analytics
                    trackCheckoutInit(pack, price);

                    // Redirect to Stripe
                    window.location.href = redirectUrl;
                } else {
                    // Payment Link not configured - Show demo message
                    showStripeSetupModal(pack, price);

                    // Reset button
                    button.disabled = false;
                    button.innerHTML = originalHTML;
                    button.classList.remove('loading');
                }

            } catch (error) {
                console.error('Stripe Checkout Error:', error);
                showNotification('Erreur lors de la redirection. Veuillez réessayer.', 'error');

                // Reset button
                button.disabled = false;
                button.innerHTML = originalHTML;
                button.classList.remove('loading');
            }
        });
    });
}

// Show Stripe Setup Modal (for demo/development)
function showStripeSetupModal(pack, price) {
    const packNames = {
        solo: 'Pack Solo (99€)',
        pro: 'Pack Pro (199€)',
        vip: 'Pack VIP (250€)'
    };

    const modal = document.createElement('div');
    modal.className = 'stripe-setup-modal';
    modal.innerHTML = `
        <div class="stripe-setup-content">
            <button class="stripe-setup-close">&times;</button>
            <div class="stripe-setup-icon">💳</div>
            <h3>Configuration Stripe Requise</h3>
            <p>Pour activer le paiement du <strong>${packNames[pack]}</strong>, configurez vos Payment Links Stripe :</p>
            
            <div class="stripe-setup-steps">
                <div class="stripe-step">
                    <span class="step-num">1</span>
                    <span>Connectez-vous à <a href="https://dashboard.stripe.com" target="_blank">Stripe Dashboard</a></span>
                </div>
                <div class="stripe-step">
                    <span class="step-num">2</span>
                    <span>Produits → Créer un produit "${packNames[pack]}"</span>
                </div>
                <div class="stripe-step">
                    <span class="step-num">3</span>
                    <span>Créez un Payment Link</span>
                </div>
                <div class="stripe-step">
                    <span class="step-num">4</span>
                    <span>Collez l'URL dans <code>js/stripe.js</code></span>
                </div>
            </div>
            
            <div class="stripe-setup-code">
                <code>STRIPE_PAYMENT_LINKS.${pack} = 'https://buy.stripe.com/...'</code>
            </div>
            
            <a href="https://stripe.com/docs/payment-links" target="_blank" class="btn btn-primary">
                📖 Documentation Stripe
            </a>
        </div>
    `;

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('.stripe-setup-close').addEventListener('click', () => {
        modal.remove();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Escape to close
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// Notification helper
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="notification-message">${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Track checkout initiation for analytics
function trackCheckoutInit(pack, price) {
    const packNames = {
        solo: "L'Horizon Crypto - Pack Solo",
        pro: "L'Horizon Crypto - Pack Pro",
        vip: "L'Horizon Crypto - Pack VIP"
    };

    // Google Analytics / GTM
    if (typeof gtag !== 'undefined') {
        gtag('event', 'begin_checkout', {
            currency: 'EUR',
            value: parseInt(price),
            items: [{
                item_id: `horizon_crypto_${pack}`,
                item_name: packNames[pack],
                price: parseInt(price),
                quantity: 1
            }]
        });
    }

    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('track', 'InitiateCheckout', {
            currency: 'EUR',
            value: parseInt(price),
            content_name: packNames[pack]
        });
    }

    console.log(`📊 Checkout initiated - ${pack} - ${price}€`);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initStripeCheckout);

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
