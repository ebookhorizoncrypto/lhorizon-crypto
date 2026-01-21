/* ========================================
   L'HORIZON CRYPTO - RGPD Cookie Consent
   Conforme CNIL / RGPD France
======================================== */

(function () {
    'use strict';

    const CONSENT_KEY = 'lhc_cookie_consent';
    const CONSENT_VERSION = '1.0';

    // Check if already consented
    function hasConsented() {
        const consent = localStorage.getItem(CONSENT_KEY);
        if (!consent) return false;
        try {
            const data = JSON.parse(consent);
            return data.version === CONSENT_VERSION;
        } catch {
            return false;
        }
    }

    // Save consent
    function saveConsent(analytics, marketing) {
        const consent = {
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
            analytics: analytics,
            marketing: marketing
        };
        localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    }

    // Create RGPD Banner
    function createBanner() {
        if (hasConsented()) return;

        const banner = document.createElement('div');
        banner.id = 'rgpd-banner';
        banner.innerHTML = `
            <div class="rgpd-content">
                <div class="rgpd-icon">🍪</div>
                <div class="rgpd-text">
                    <h4>Nous respectons votre vie privée</h4>
                    <p>
                        Nous utilisons des cookies pour améliorer votre expérience, analyser le trafic et personnaliser les contenus.
                        Conformément au <strong>RGPD</strong> et aux recommandations de la <strong>CNIL</strong>, vous pouvez gérer vos préférences.
                        <a href="confidentialite.html" target="_blank">Politique de confidentialité</a>
                    </p>
                </div>
                <div class="rgpd-actions">
                    <button class="rgpd-btn rgpd-accept-all">✓ Tout accepter</button>
                    <button class="rgpd-btn rgpd-reject-all">✗ Tout refuser</button>
                    <button class="rgpd-btn rgpd-customize">⚙️ Personnaliser</button>
                </div>
            </div>
            <div class="rgpd-customize-panel" style="display: none;">
                <h4>Personnaliser vos préférences</h4>
                <div class="rgpd-option">
                    <label>
                        <input type="checkbox" checked disabled>
                        <strong>Cookies essentiels</strong> (toujours actifs)
                        <p>Nécessaires au fonctionnement du site.</p>
                    </label>
                </div>
                <div class="rgpd-option">
                    <label>
                        <input type="checkbox" id="rgpd-analytics" checked>
                        <strong>Cookies analytiques</strong>
                        <p>Nous aident à comprendre comment vous utilisez le site (Google Analytics).</p>
                    </label>
                </div>
                <div class="rgpd-option">
                    <label>
                        <input type="checkbox" id="rgpd-marketing">
                        <strong>Cookies marketing</strong>
                        <p>Utilisés pour vous proposer des publicités pertinentes.</p>
                    </label>
                </div>
                <div class="rgpd-actions">
                    <button class="rgpd-btn rgpd-save">Enregistrer mes choix</button>
                </div>
            </div>
        `;

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            #rgpd-banner {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-top: 1px solid rgba(247, 147, 26, 0.3);
                padding: 20px;
                z-index: 999999;
                font-family: 'Inter', sans-serif;
                box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
                animation: slideUp 0.5s ease-out;
            }

            @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            .rgpd-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                gap: 20px;
                flex-wrap: wrap;
            }

            .rgpd-icon {
                font-size: 2.5rem;
                flex-shrink: 0;
            }

            .rgpd-text {
                flex: 1;
                min-width: 300px;
            }

            .rgpd-text h4 {
                color: #f7931a;
                margin-bottom: 8px;
                font-size: 1.1rem;
            }

            .rgpd-text p {
                color: #a0a0b0;
                font-size: 0.9rem;
                line-height: 1.5;
                margin: 0;
            }

            .rgpd-text a {
                color: #00d4ff;
                text-decoration: underline;
            }

            .rgpd-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }

            .rgpd-btn {
                padding: 12px 20px;
                border: none;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            .rgpd-accept-all {
                background: linear-gradient(135deg, #00ff88, #00cc6a);
                color: #000;
            }

            .rgpd-reject-all {
                background: rgba(255, 71, 87, 0.2);
                color: #ff4757;
                border: 1px solid #ff4757;
            }

            .rgpd-customize, .rgpd-save {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .rgpd-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            }

            .rgpd-customize-panel {
                max-width: 1200px;
                margin: 20px auto 0;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .rgpd-customize-panel h4 {
                color: #f7931a;
                margin-bottom: 16px;
            }

            .rgpd-option {
                margin-bottom: 16px;
            }

            .rgpd-option label {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                color: #fff;
                cursor: pointer;
            }

            .rgpd-option input[type="checkbox"] {
                width: 20px;
                height: 20px;
                accent-color: #f7931a;
                margin-top: 2px;
            }

            .rgpd-option strong {
                display: block;
                margin-bottom: 4px;
            }

            .rgpd-option p {
                color: #a0a0b0;
                font-size: 0.85rem;
                margin: 0;
            }

            @media (max-width: 768px) {
                .rgpd-content {
                    flex-direction: column;
                    text-align: center;
                }
                .rgpd-actions {
                    justify-content: center;
                    width: 100%;
                }
                .rgpd-btn {
                    flex: 1;
                    min-width: 100px;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(banner);

        // Event handlers
        banner.querySelector('.rgpd-accept-all').addEventListener('click', () => {
            saveConsent(true, true);
            banner.remove();
            console.log('RGPD: All cookies accepted');
        });

        banner.querySelector('.rgpd-reject-all').addEventListener('click', () => {
            saveConsent(false, false);
            banner.remove();
            console.log('RGPD: All cookies rejected');
        });

        banner.querySelector('.rgpd-customize').addEventListener('click', () => {
            const panel = banner.querySelector('.rgpd-customize-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        banner.querySelector('.rgpd-save').addEventListener('click', () => {
            const analytics = document.getElementById('rgpd-analytics').checked;
            const marketing = document.getElementById('rgpd-marketing').checked;
            saveConsent(analytics, marketing);
            banner.remove();
            console.log('RGPD: Custom preferences saved', { analytics, marketing });
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBanner);
    } else {
        createBanner();
    }
})();
