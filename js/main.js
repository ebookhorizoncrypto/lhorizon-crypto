/* ========================================
   L'HORIZON CRYPTO - Main JavaScript
   Animations & Interactions
======================================== */

document.addEventListener('DOMContentLoaded', () => {
    // CRITICAL: Mobile Menu First
    try {
        initMobileMenu();
    } catch (e) {
        console.error('Mobile menu init failed:', e);
    }

    // Other initializations
    // initCinematicIntro(); // Disabled per user request
    initNavbarScroll();
    initScrollAnimations();
    initSmoothScroll();
    initButtonEffects();
    initSocialProofTicker();
    initEmailForm();
    initTestimonialsCarousel();
    initLeadMagnetForm();
    initWalletConnection();
    initPackAccordion();
});

/* ========================================
   MOBILE HAMBURGER MENU
======================================== */
function initMobileMenu() {
    // Checkbox Hack Implementation
    const checkbox = document.getElementById('nav-toggle');
    if (!checkbox) return;

    const navLinks = document.querySelector('.nav-links');
    const overlay = document.querySelector('.mobile-menu-overlay');

    // Helper to close menu
    const closeMenu = () => {
        checkbox.checked = false;
    };

    // 1. Close when clicking a link
    if (navLinks) {
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }

    // 2. Close when clicking overlay
    if (overlay) {
        overlay.addEventListener('click', closeMenu);
    }

    // 3. Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && checkbox.checked) {
            closeMenu();
        }
    });

    console.log('Mobile Menu (CSS Hack) initialized');
    return; // Stop execution of old code below

    /* Legacy Code Below - Ignored */
    const toggle = null;
    /*

    // Toggle Function
    function toggleMenu() {
        const isActive = navLinks.classList.contains('active');

        if (isActive) {
            // Close
            toggle.classList.remove('active');
            navLinks.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.classList.remove('menu-open');

            // Cleanup inline styles to let CSS take over
            navLinks.style.removeProperty('left');
            navLinks.style.removeProperty('display');
        } else {
            // Open
            toggle.classList.add('active');
            navLinks.classList.add('active');
            if (overlay) overlay.classList.add('active');
            document.body.classList.add('menu-open');

            // Force visibility (Failsafe)
            navLinks.style.setProperty('left', '0', 'important');
            navLinks.style.setProperty('display', 'flex', 'important');
        }
    }

    // Event Listeners
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    // Close on overlay click
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) toggleMenu();
        });
    }

    // Close on nav link click
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) toggleMenu();
        });
    });
    */
}

/* ========================================
   CINEMATIC INTRO VIDEO
======================================== */
/* Cinematic Intro Removed */

/* ========================================
   TESTIMONIALS INFINITE CAROUSEL
======================================== */
function initTestimonialsCarousel() {
    const carousel = document.querySelector('.testimonials-carousel');
    if (!carousel) return;

    // Duplicate all cards for seamless infinite scroll
    const cards = carousel.querySelectorAll('.testimonial-card');
    cards.forEach(card => {
        const clone = card.cloneNode(true);
        carousel.appendChild(clone);
    });
}

/* ========================================
   LEAD MAGNET FORM - FREE EXTRACT
======================================== */
function initLeadMagnetForm() {
    // Landing Page Form
    setupExtractForm('lead-magnet-form', 'lead-email', 'lead-success', 'lead-error');

    // Offers Page Form
    setupExtractForm('extract-form', 'extract-email', 'extract-success', null); // null error div (handled inside or alert)
}

function setupExtractForm(formId, emailId, successId, errorId) {
    const form = document.getElementById(formId);
    if (!form) return;

    const emailInput = document.getElementById(emailId);
    if (!emailInput) return;

    const btn = form.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text') || btn; // Fallback if structure differs
    const btnLoading = btn.querySelector('.btn-loading');

    const successDiv = document.getElementById(successId);
    const errorDiv = errorId ? document.getElementById(errorId) : null;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        if (!email || !email.includes('@')) {
            if (errorDiv) {
                errorDiv.style.display = 'block';
                errorDiv.querySelector('p').textContent = '❌ Veuillez entrer un email valide.';
            } else {
                alert('Veuillez entrer un email valide.');
            }
            return;
        }

        // Show loading
        if (btnLoading) {
            if (btnText.style) btnText.style.display = 'none';
            btnLoading.style.display = 'inline';
        } else {
            btn.textContent = 'Envoi...';
            btn.disabled = true;
        }

        if (errorDiv) errorDiv.style.display = 'none';

        try {
            // API call to send extract email
            // Determine API URL (Local vs Prod)
            const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://127.0.0.1:3001'
                : '';

            const response = await fetch(`${apiBase}/api/lead-magnet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                // Success
                form.style.display = 'none';
                if (successDiv) successDiv.style.display = 'block';

                localStorage.setItem('lhorizon_lead_subscribed', email);
                localStorage.setItem('user_email', email);

                // Track conversion
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'generate_lead', { currency: 'EUR', value: 0 });
                }
                if (typeof fbq !== 'undefined') {
                    fbq('track', 'Lead');
                }
            } else {
                throw new Error(`Erreur serveur ${response.status}`);
            }
        } catch (error) {
            console.error('Lead magnet error:', error);

            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                // Demo / Fallback
                form.style.display = 'none';
                if (successDiv) successDiv.style.display = 'block';
                console.log('📧 Demo mode (Network Error): Email simulated for', email);
            } else {
                if (errorDiv) {
                    errorDiv.style.display = 'block';
                    errorDiv.querySelector('p').textContent = `❌ Erreur: ${error.message}`;
                } else {
                    alert(`Erreur: ${error.message}`);
                }

                // Reset button
                if (btnLoading) {
                    if (btnText.style) btnText.style.display = 'inline';
                    btnLoading.style.display = 'none';
                } else {
                    btn.textContent = 'RECEVOIR L\'EXTRAIT';
                    btn.disabled = false;
                }
            }
        }
    });
}

// Add to DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // initLeadMagnetForm(); // REMOVED: Already initialized in the main DOMContentLoaded block above

    // Load Crypto Ticker
    const script = document.createElement('script');
    script.src = 'js/crypto-ticker.js';
    document.body.appendChild(script);
});


/* ========================================
   NAVBAR SCROLL EFFECT
======================================== */
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Add/remove background opacity based on scroll
        if (currentScroll > 50) {
            navbar.style.background = 'rgba(10, 10, 15, 0.98)';
            navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(10, 10, 15, 0.8)';
            navbar.style.boxShadow = 'none';
        }

        // Hide/show navbar on scroll direction
        if (currentScroll > lastScroll && currentScroll > 200) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }

        lastScroll = currentScroll;
    });
}

/* ========================================
   SCROLL ANIMATIONS (Fade In)
======================================== */
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Elements to animate
    const animateElements = document.querySelectorAll(`
        .trust-card,
        .preview-card,
        .program-card,
        .testimonial-card,
        .comparison-table .table-row,
        .faq-item,
        .warning-box,
        .pricing-card-single,
        .author-content,
        .guarantee-box,
        .urgency-box
    `);

    animateElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `opacity 0.6s ease ${(index % 6) * 0.1}s, transform 0.6s ease ${(index % 6) * 0.1}s`;
        observer.observe(el);
    });
}

// Add CSS class for animated elements
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;
document.head.appendChild(style);

/* ========================================
   SMOOTH SCROLL
======================================== */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                const offsetTop = target.offsetTop - 100;

                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ========================================
   BUTTON EFFECTS
======================================== */
function initButtonEffects() {
    const buttons = document.querySelectorAll('.btn-primary');

    buttons.forEach(button => {
        button.addEventListener('mouseenter', function (e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.style.setProperty('--mouse-x', `${x}px`);
            this.style.setProperty('--mouse-y', `${y}px`);
        });

        // Add ripple effect on click
        button.addEventListener('click', function (e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 1000);
        });
    });
}

// Add ripple styles
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
    .btn-primary {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        width: 20px;
        height: 20px;
        background: rgba(255, 255, 255, 0.4);
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0);
        animation: ripple-animation 1s ease-out;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: translate(-50%, -50%) scale(20);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyle);

/* ========================================
   SOCIAL PROOF TICKER
======================================== */
function initSocialProofTicker() {
    const ticker = document.querySelector('.ticker-content');
    if (!ticker) return;

    // Duplicate content for seamless loop
    const content = ticker.innerHTML;
    ticker.innerHTML = content + content;
}

/* ========================================
   EMAIL FORM HANDLING
======================================== */
function initEmailForm() {
    const form = document.getElementById('email-form');
    const modal = document.getElementById('success-modal');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('email-input');
        const email = emailInput.value.trim();
        const submitBtn = form.querySelector('button[type="submit"]');

        // Validate email
        if (!isValidEmail(email)) {
            showNotification('Veuillez entrer une adresse email valide.', 'error');
            return;
        }

        // Show loading state
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Envoi...';

        // Simulate API call
        await simulateApiCall(email);

        // Show success
        if (modal) {
            modal.classList.add('active');
            createConfetti();
        } else {
            showNotification('Merci ! Vérifiez votre email pour recevoir le guide gratuit.', 'success');
            createConfetti();
        }

        // Reset form
        form.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        // Store email
        storeEmail(email);
    });

    // Modal close handlers
    const modalClose = document.getElementById('modal-close');
    if (modalClose && modal) {
        modalClose.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }
}

function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

async function simulateApiCall(email) {
    return new Promise(resolve => setTimeout(resolve, 1500));
}

function storeEmail(email) {
    const emails = JSON.parse(localStorage.getItem('horizon_emails') || '[]');
    emails.push({
        email,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('horizon_emails', JSON.stringify(emails));
    console.log('📧 Email enregistré:', email);
}

/* ========================================
   NOTIFICATION SYSTEM
======================================== */
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

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

/* ========================================
   CONFETTI EFFECT
======================================== */
function createConfetti() {
    const colors = ['#f7931a', '#9945ff', '#00d4ff', '#00ff88', '#ffbe0b', '#ff6b6b'];
    const confettiCount = 80;

    for (let i = 0; i < confettiCount; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.width = (Math.random() * 8 + 5) + 'px';
            confetti.style.height = (Math.random() * 8 + 5) + 'px';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 5000);
        }, i * 30);
    }
}

// Add notification and confetti styles
const extraStyles = document.createElement('style');
extraStyles.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 24px;
        background: rgba(26, 26, 46, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: #fff;
        font-size: 0.95rem;
        z-index: 3000;
        backdrop-filter: blur(10px);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        transition: transform 0.3s ease;
    }
    
    .notification.show {
        transform: translateX(-50%) translateY(0);
    }
    
    .notification-success {
        border-color: rgba(0, 255, 136, 0.3);
    }
    
    .notification-error {
        border-color: rgba(255, 71, 87, 0.3);
    }
    
    .confetti {
        position: fixed;
        top: -10px;
        z-index: 2500;
        animation: confetti-fall 3s ease-out forwards;
        pointer-events: none;
    }
    
    @keyframes confetti-fall {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(extraStyles);

console.log('🌅 L\'Horizon Crypto - Landing Page Loaded');

/* ========================================
   WALLET CONNECTION (Reown AppKit Integration)
======================================== */
function initWalletConnection() {
    const walletBtn = document.getElementById('header-wallet-btn');
    const walletBtnText = document.getElementById('wallet-btn-text');
    const walletIcon = document.getElementById('wallet-icon');
    const disconnectBtn = document.getElementById('wallet-disconnect-btn');
    const container = walletBtn?.closest('.wallet-btn-container');

    if (!walletBtn || !walletBtnText) {
        console.warn('[Wallet] Button elements not found');
        return;
    }

    let connectedAddress = null;

    // Update UI to connected state
    function updateUIConnected(address) {
        connectedAddress = address;
        const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

        // Update button appearance
        walletBtn.classList.add('connected');
        walletBtn.style.background = 'linear-gradient(135deg, #00ff88, #00cc6a)';
        walletBtn.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.3)';

        // Update text with monospace address
        walletBtnText.innerHTML = `<span class="wallet-address">${shortAddr}</span>`;

        // Update icon to checkmark
        if (walletIcon) walletIcon.textContent = '✓';

        // Show disconnect button
        if (disconnectBtn) disconnectBtn.style.display = '';

        console.log('[Wallet] UI updated - Connected:', shortAddr);
    }

    // Update UI to disconnected state
    function updateUIDisconnected() {
        connectedAddress = null;

        // Reset button appearance
        walletBtn.classList.remove('connected');
        walletBtn.style.background = 'linear-gradient(135deg, #627EEA, #4a5fc7)';
        walletBtn.style.boxShadow = '0 4px 15px rgba(98, 126, 234, 0.3)';

        // Reset text
        walletBtnText.textContent = 'Connecter';

        // Reset icon
        if (walletIcon) walletIcon.textContent = '💎';

        // Hide disconnect button and dropdown
        if (disconnectBtn) disconnectBtn.style.display = 'none';
        if (container) container.classList.remove('show-disconnect');

        console.log('[Wallet] UI updated - Disconnected');
    }

    // Expose handlers globally for AppKit events
    window.handleWalletConnected = updateUIConnected;
    window.handleWalletDisconnected = updateUIDisconnected;

    // Connect wallet via AppKit modal
    async function connectWallet() {
        console.log('[Wallet] Connect triggered');

        if (window.openWalletModal) {
            try {
                await window.openWalletModal();
            } catch (e) {
                console.error('[Wallet] Modal error:', e);
            }
        } else {
            console.warn('[Wallet] AppKit not loaded');

            // Fallback: Direct MetaMask connection
            if (typeof window.ethereum !== 'undefined') {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    if (accounts.length > 0) updateUIConnected(accounts[0]);
                } catch (e) {
                    console.error('[Wallet] MetaMask fallback error:', e);
                }
            } else {
                alert('Veuillez installer MetaMask ou un wallet compatible.');
            }
        }
    }

    // Disconnect wallet
    async function disconnectWallet() {
        console.log('[Wallet] Disconnect triggered');

        if (window.disconnectWalletModal) {
            try {
                await window.disconnectWalletModal();
            } catch (e) {
                console.warn('[Wallet] Disconnect error:', e);
            }
        }
        updateUIDisconnected();
    }

    // Main button click handler
    walletBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (connectedAddress) {
            // Toggle disconnect dropdown
            if (container) container.classList.toggle('show-disconnect');
        } else {
            // Open connect modal
            connectWallet();
        }
    });

    // Disconnect button click handler
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            disconnectWallet();
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (container && !container.contains(e.target)) {
            container.classList.remove('show-disconnect');
        }
    });

    // Listen for MetaMask account changes (as backup)
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                updateUIDisconnected();
            } else if (!connectedAddress) {
                updateUIConnected(accounts[0]);
            }
        });
    }

    console.log('[Wallet] Connection module initialized');
}

/* ========================================
   PACK ACCORDION (Mobile)
======================================== */
function initPackAccordion() {
    // Add toggle buttons to pricing cards
    document.querySelectorAll('.pricing-card').forEach(card => {
        // Check if toggle already exists
        if (card.querySelector('.pack-toggle')) return;

        // Create toggle button
        const toggle = document.createElement('button');
        toggle.className = 'pack-toggle';
        toggle.textContent = 'Voir les détails';
        toggle.type = 'button';

        // Insert AFTER the pricing features list
        const featuresList = card.querySelector('.pricing-features');
        if (featuresList) {
            featuresList.insertAdjacentElement('afterend', toggle);
        } else {
            // Fallback
            card.appendChild(toggle);
        }

        // Toggle click handler
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            card.classList.toggle('expanded');
            toggle.textContent = card.classList.contains('expanded') ? 'Masquer' : 'Voir les détails';
        });
    });
}

// [NEW] Système "Voir plus" pour trust items sur mobile
document.addEventListener('DOMContentLoaded', function () {
    // Sélectionner les containers (UNIQUEMENT pricing-trust sur offres, pas landing page)
    const trustContainers = document.querySelectorAll('.pricing-trust');

    trustContainers.forEach(function (container) {
        // Éviter les doublons si déjà initialisé
        if (container.classList.contains('has-see-more')) return;
        container.classList.add('has-see-more');

        // Créer le bouton
        const voirPlusBtn = document.createElement('button');
        voirPlusBtn.className = 'voir-plus-trust-btn';
        voirPlusBtn.innerHTML = '<span class="btn-text">Voir plus</span><span class="arrow">▼</span>';

        // Ajouter après le container
        container.parentNode.insertBefore(voirPlusBtn, container.nextSibling);

        // Gérer le clic
        voirPlusBtn.addEventListener('click', function () {
            container.classList.toggle('expanded');

            const btnText = voirPlusBtn.querySelector('.btn-text');
            const arrow = voirPlusBtn.querySelector('.arrow');

            if (container.classList.contains('expanded')) {
                btnText.textContent = 'Voir moins';
                arrow.style.transform = 'rotate(180deg)';
                // Optionnel : Scroll vers le haut du conteneur lors de la fermeture ? Non demandé.
            } else {
                btnText.textContent = 'Voir plus';
                arrow.style.transform = 'rotate(0deg)';
                // Scroll smooth vers le haut si on ferme (optionnel)
            }
        });
    });
});

// [FIXED] Système "Voir plus" pour Pricing Features (Mobile)
// Crée dynamiquement les boutons et gère les éléments .mobile-hidden
// [FIXED] Système "Voir plus" pour Pricing Features (Mobile)
// Les boutons existent déjà dans le HTML et leur visibilité est gérée par CSS
function initPricingSeeMore() {
    const seeMoreBtns = document.querySelectorAll('.see-more-features-btn');
    console.log('[SeeMore] Initializing simple logic for', seeMoreBtns.length, 'buttons');

    seeMoreBtns.forEach(btn => {
        // Supprimer les anciens listeners (cloner le bouton)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const pricingContent = this.closest('.pricing-content');
            const featuresList = pricingContent.querySelector('.pricing-features');

            if (!featuresList) return;

            // Toggle la classe "expanded" sur la liste
            // Le CSS se charge d'afficher les éléments .mobile-hidden quand .expanded est présent
            const isExpanded = featuresList.classList.toggle('expanded');
            this.classList.toggle('expanded', isExpanded);

            // Mettre à jour le texte et l'icône
            const textSpan = this.querySelector('.see-more-text');
            const iconSpan = this.querySelector('.see-more-icon');

            if (isExpanded) {
                if (textSpan) textSpan.textContent = 'Voir moins';
                if (iconSpan) iconSpan.style.transform = 'rotate(180deg)';
            } else {
                if (textSpan) textSpan.textContent = 'Voir plus';
                if (iconSpan) iconSpan.style.transform = 'rotate(0deg)';
            }
        });
    });
}

// Lancer immédiatement si DOM déjà prêt, sinon attendre
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPricingSeeMore);
} else {
    initPricingSeeMore();
}



