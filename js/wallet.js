/**
 * L'Horizon Crypto - Wallet Connection Module
 * Reown AppKit Integration (WalletConnect v2)
 *
 * Features:
 * - Multi-wallet support (MetaMask, Rainbow, Trust, Coinbase, etc.)
 * - Mobile deep linking
 * - Persistent sessions
 * - EIP-6963 wallet detection
 */

// Configuration - Can be overridden via window.WALLET_CONFIG
const DEFAULT_CONFIG = {
    projectId: 'ab69881fb47e7ca4ae5636c982bc6d34',
    metadata: {
        name: "L'Horizon Crypto",
        description: 'Guide Crypto Proof of Learning - Gagnez des USDC',
        url: 'https://ebook-horizoncrypto.com',
        icons: ['https://ebook-horizoncrypto.com/assets/logo-horizon-crypto.png']
    },
    networks: ['base', 'mainnet'],
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#627EEA',
        '--w3m-border-radius-master': '8px'
    }
};

// Wallet state
let modal = null;
let isInitialized = false;
let currentAddress = null;
let currentChainId = null;

// Event callbacks
const eventCallbacks = {
    onConnect: [],
    onDisconnect: [],
    onAccountChange: [],
    onChainChange: [],
    onError: []
};

/**
 * Initialize the wallet module
 * Must be called after the Reown AppKit CDN scripts are loaded
 */
async function initWallet(customConfig = {}) {
    if (isInitialized) {
        console.warn('[Wallet] Already initialized');
        return;
    }

    const config = { ...DEFAULT_CONFIG, ...customConfig };

    // Check if Reown AppKit is loaded
    if (typeof window.createAppKit === 'undefined') {
        console.error('[Wallet] Reown AppKit not loaded. Make sure CDN scripts are included.');
        triggerEvent('onError', { message: 'AppKit not loaded' });
        return;
    }

    try {
        // Get network definitions
        const networks = config.networks.map(n => {
            if (n === 'base') return window.appKitNetworks.base;
            if (n === 'mainnet') return window.appKitNetworks.mainnet;
            if (n === 'arbitrum') return window.appKitNetworks.arbitrum;
            if (n === 'polygon') return window.appKitNetworks.polygon;
            return null;
        }).filter(Boolean);

        // Create AppKit instance
        modal = window.createAppKit({
            adapters: [new window.EthersAdapter()],
            networks,
            metadata: config.metadata,
            projectId: config.projectId,
            themeMode: config.themeMode,
            themeVariables: config.themeVariables,
            features: {
                analytics: true,
                email: false,
                socials: false
            },
            // Critical for mobile wallet detection
            enableInjected: true,
            enableEIP6963: true,
            enableCoinbase: true,
            enableWalletConnect: true,
            // Featured wallets for better UX
            featuredWalletIds: [
                'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
                '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust
                '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
                'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa'  // Coinbase
            ]
        });

        // Subscribe to modal events
        modal.subscribeEvents(handleModalEvent);

        // Subscribe to state changes
        modal.subscribeState(handleStateChange);

        isInitialized = true;
        console.log('[Wallet] Initialized successfully');

        // Check for existing connection
        await checkExistingConnection();

    } catch (error) {
        console.error('[Wallet] Initialization error:', error);
        triggerEvent('onError', { message: error.message });
    }
}

/**
 * Handle modal events
 */
function handleModalEvent(event) {
    const eventName = event?.data?.event;
    console.log('[Wallet] Event:', eventName, event);

    switch (eventName) {
        case 'CONNECT_SUCCESS':
            handleConnect();
            break;
        case 'DISCONNECT_SUCCESS':
            handleDisconnect();
            break;
        case 'MODAL_CLOSE':
            // Modal closed without action
            break;
    }
}

/**
 * Handle state changes
 */
function handleStateChange(state) {
    if (state.selectedNetworkId && state.selectedNetworkId !== currentChainId) {
        currentChainId = state.selectedNetworkId;
        triggerEvent('onChainChange', { chainId: currentChainId });
    }
}

/**
 * Handle successful connection
 */
async function handleConnect() {
    try {
        const address = modal.getAddress();
        if (address && address !== currentAddress) {
            currentAddress = address;
            currentChainId = modal.getChainId?.() || null;

            // Save to localStorage for persistence
            localStorage.setItem('walletConnected', 'true');
            localStorage.setItem('connectedWallet', address);

            triggerEvent('onConnect', {
                address,
                chainId: currentChainId,
                shortAddress: formatAddress(address)
            });
        }
    } catch (error) {
        console.error('[Wallet] Connect handler error:', error);
    }
}

/**
 * Handle disconnection
 */
function handleDisconnect() {
    currentAddress = null;
    currentChainId = null;

    localStorage.removeItem('walletConnected');
    localStorage.removeItem('connectedWallet');

    triggerEvent('onDisconnect', {});
}

/**
 * Check for existing connection on page load
 */
async function checkExistingConnection() {
    // Small delay to let AppKit restore session
    await new Promise(resolve => setTimeout(resolve, 800));

    const address = modal?.getAddress?.();
    if (address) {
        currentAddress = address;
        currentChainId = modal.getChainId?.() || null;
        triggerEvent('onConnect', {
            address,
            chainId: currentChainId,
            shortAddress: formatAddress(address),
            restored: true
        });
    }
}

/**
 * Open the wallet connection modal
 */
async function openModal() {
    if (!modal) {
        console.error('[Wallet] Not initialized');
        return;
    }

    try {
        await modal.open();
    } catch (error) {
        console.error('[Wallet] Open modal error:', error);
        triggerEvent('onError', { message: error.message });
    }
}

/**
 * Disconnect the wallet
 */
async function disconnect() {
    if (!modal) return;

    try {
        await modal.disconnect();
        handleDisconnect();
    } catch (error) {
        console.error('[Wallet] Disconnect error:', error);
        // Force local cleanup even if disconnect fails
        handleDisconnect();
    }
}

/**
 * Get current connection state
 */
function getState() {
    return {
        isConnected: !!currentAddress,
        address: currentAddress,
        shortAddress: currentAddress ? formatAddress(currentAddress) : null,
        chainId: currentChainId
    };
}

/**
 * Format address to short version (0x1234...abcd)
 */
function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Register event callback
 */
function on(event, callback) {
    if (eventCallbacks[event]) {
        eventCallbacks[event].push(callback);
    }
}

/**
 * Remove event callback
 */
function off(event, callback) {
    if (eventCallbacks[event]) {
        eventCallbacks[event] = eventCallbacks[event].filter(cb => cb !== callback);
    }
}

/**
 * Trigger event callbacks
 */
function triggerEvent(event, data) {
    if (eventCallbacks[event]) {
        eventCallbacks[event].forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error(`[Wallet] Event callback error (${event}):`, e);
            }
        });
    }

    // Also notify global handlers from main.js
    if (event === 'onConnect' && data.address && typeof window.handleWalletConnected === 'function') {
        window.handleWalletConnected(data.address);
    }
    if (event === 'onDisconnect' && typeof window.handleWalletDisconnected === 'function') {
        window.handleWalletDisconnected();
    }
}

/**
 * Get the Ethers provider (for signing transactions)
 */
function getProvider() {
    return modal?.getProvider?.() || null;
}

// Export to window for global access
window.HorizonWallet = {
    init: initWallet,
    open: openModal,
    disconnect,
    getState,
    getProvider,
    on,
    off,
    formatAddress
};

// Also expose for backwards compatibility
window.openWalletModal = openModal;
window.disconnectWalletModal = disconnect;
