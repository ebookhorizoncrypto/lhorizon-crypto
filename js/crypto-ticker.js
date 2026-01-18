/* ========================================
   CRYPTO TICKER & CHART WIDGET
   Fetches live BTC/ETH prices with color-coded changes
   Shows TradingView candlestick chart
======================================== */

// Config
const TICKER_CONFIG = {
    updateInterval: 15000, // 15 seconds (CoinGecko rate limit friendly)
    api: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
};

// Store previous prices for comparison
let previousPrices = { btc: null, eth: null };

// Safe Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCryptoTicker);
} else {
    initCryptoTicker();
}

function initCryptoTicker() {
    // Prevent double initialization
    if (document.querySelector('.crypto-ticker-pill')) return;

    // Create Widget DOM
    createTickerDOM();

    // Initial Fetch
    fetchPrices();

    // Interval Fetch
    setInterval(fetchPrices, TICKER_CONFIG.updateInterval);

    // Event Listeners
    setupChartModal();
}

function createTickerDOM() {
    // Create Floating Ticker
    const tickerContainer = document.createElement('div');
    tickerContainer.className = 'crypto-ticker-pill';
    tickerContainer.innerHTML = `
        <div class="ticker-item" data-coin="BTC">
            <span class="coin-icon">₿</span>
            <span class="coin-name">BTC</span>
            <span class="coin-price" id="price-btc">...</span>
            <span class="coin-change" id="change-btc"></span>
        </div>
        <div class="ticker-divider"></div>
        <div class="ticker-item" data-coin="ETH">
            <span class="coin-icon">Ξ</span>
            <span class="coin-name">ETH</span>
            <span class="coin-price" id="price-eth">...</span>
            <span class="coin-change" id="change-eth"></span>
        </div>
        <div class="ticker-action">
            <span class="chart-icon">📊</span>
        </div>
    `;
    document.body.appendChild(tickerContainer);

    // Create Modal for Chart
    const modal = document.createElement('div');
    modal.className = 'crypto-chart-modal';
    modal.id = 'chart-modal';
    modal.innerHTML = `
        <div class="chart-modal-content">
            <button class="modal-close-btn" id="close-chart">×</button>
            <div class="chart-header">
                <h3>Marché en direct</h3>
                <div class="chart-tabs">
                    <button class="chart-tab active" data-symbol="BTCUSD">Bitcoin</button>
                    <button class="chart-tab" data-symbol="ETHUSD">Ethereum</button>
                </div>
                <div class="chart-type-toggle">
                    <button class="chart-type-btn active" data-type="candles" title="Bougies">🕯️</button>
                    <button class="chart-type-btn" data-type="line" title="Ligne">📈</button>
                </div>
            </div>
            <div class="chart-container" id="tv-chart-container">
                <!-- TradingView Widget will be injected here -->
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function fetchPrices() {
    try {
        const response = await fetch(TICKER_CONFIG.api);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();

        updatePrice('btc', data.bitcoin.usd, data.bitcoin.usd_24h_change);
        updatePrice('eth', data.ethereum.usd, data.ethereum.usd_24h_change);
    } catch (error) {
        console.error('Ticker Error:', error);
    }
}

function updatePrice(id, price, change24h) {
    const priceEl = document.getElementById(`price-${id}`);
    const changeEl = document.getElementById(`change-${id}`);

    if (!priceEl || !changeEl) return;

    // Format price: $95,432
    const formattedPrice = '$' + price.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });

    // Determine direction based on 24h change
    const isUp = change24h >= 0;
    const changeFormatted = (isUp ? '+' : '') + change24h.toFixed(1) + '%';

    // Apply color classes
    priceEl.classList.remove('price-up', 'price-down');
    changeEl.classList.remove('change-up', 'change-down');

    if (isUp) {
        priceEl.classList.add('price-up');
        changeEl.classList.add('change-up');
    } else {
        priceEl.classList.add('price-down');
        changeEl.classList.add('change-down');
    }

    // Flash animation on change
    if (previousPrices[id] !== null && previousPrices[id] !== price) {
        priceEl.classList.add('price-flash');
        setTimeout(() => priceEl.classList.remove('price-flash'), 600);
    }

    priceEl.textContent = formattedPrice;
    changeEl.textContent = changeFormatted;

    // Store for next comparison
    previousPrices[id] = price;
}

// Current chart state
let currentChartType = 'candles';
let currentSymbol = 'BTCUSD';

function setupChartModal() {
    const ticker = document.querySelector('.crypto-ticker-pill');
    const modal = document.getElementById('chart-modal');
    const closeBtn = document.getElementById('close-chart');
    const tabs = document.querySelectorAll('.chart-tab');
    const typeBtns = document.querySelectorAll('.chart-type-btn');

    // Open Modal
    ticker.addEventListener('click', () => {
        modal.classList.add('active');
        loadTradingViewWidget(currentSymbol, currentChartType);
    });

    // Close Modal
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Switch Coin Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSymbol = tab.dataset.symbol;
            loadTradingViewWidget(currentSymbol, currentChartType);
        });
    });

    // Switch Chart Type
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChartType = btn.dataset.type;
            loadTradingViewWidget(currentSymbol, currentChartType);
        });
    });
}

function loadTradingViewWidget(symbol, chartType = 'candles') {
    const container = document.getElementById('tv-chart-container');
    container.innerHTML = ''; // Clear previous

    if (chartType === 'candles') {
        // Use Advanced Chart for candlesticks
        const widget = document.createElement('div');
        widget.className = 'tradingview-widget-container';
        widget.style.height = '100%';
        widget.style.width = '100%';
        widget.innerHTML = `
            <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
        `;
        container.appendChild(widget);

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": "COINBASE:" + symbol,
            "interval": "60",
            "timezone": "Europe/Paris",
            "theme": "dark",
            "style": "1",
            "locale": "fr",
            "backgroundColor": "rgba(20, 20, 30, 1)",
            "gridColor": "rgba(255, 255, 255, 0.05)",
            "hide_top_toolbar": false,
            "hide_legend": false,
            "allow_symbol_change": false,
            "save_image": false,
            "calendar": false,
            "support_host": "https://www.tradingview.com"
        });
        widget.appendChild(script);
    } else {
        // Use Mini Symbol Overview for line chart
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            "symbol": "COINBASE:" + symbol,
            "width": "100%",
            "height": "100%",
            "locale": "fr",
            "dateRange": "12M",
            "colorTheme": "dark",
            "trendLineColor": "rgba(247, 147, 26, 1)",
            "underLineColor": "rgba(247, 147, 26, 0.3)",
            "underLineBottomColor": "rgba(247, 147, 26, 0)",
            "isTransparent": true,
            "autosize": true,
            "largeChartUrl": ""
        });
        container.appendChild(script);
    }
}
