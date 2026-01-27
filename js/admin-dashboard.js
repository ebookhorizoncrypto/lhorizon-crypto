
// Admin Dashboard Logic

let apiKey = localStorage.getItem('admin_key') || '';
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : '';

// Show dashboard function
function showDashboard() {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');

    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboard) dashboard.classList.add('active');

    updateData();
    fetchCustomers();

    // Init charts and visitors
    setTimeout(() => {
        const cv = document.getElementById('visitors-count');
        if (cv && typeof updateVisitorsDisplay === 'function') updateVisitorsDisplay();
        if (typeof simulateVisitors === 'function') simulateVisitors();
        if (typeof initCharts === 'function') initCharts();
    }, 500);

    // Polling
    setInterval(() => {
        if (document.getElementById('dashboard') && document.getElementById('dashboard').classList.contains('active')) {
            updateData();
            fetchCustomers();
        }
    }, 30000);
}

// Auto Login
if (apiKey) {
    // Wait for DOM
    document.addEventListener('DOMContentLoaded', showDashboard);
}

function login() {
    const input = document.getElementById('api-key-input');
    if (!input) return;
    const key = input.value;

    if (!key) return alert('Veuillez entrer une clé');

    localStorage.setItem('admin_key', key);
    apiKey = key;
    showDashboard();
}

// Set current date
document.addEventListener('DOMContentLoaded', () => {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Enter key listener
    const keyInput = document.getElementById('api-key-input');
    if (keyInput) {
        keyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }
});

function switchSection(sectionId, element) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');
    // Show target section
    const target = document.getElementById('section-' + sectionId);
    if (target) target.style.display = 'block';

    // Update active state in sidebar
    if (element) {
        document.querySelectorAll('.sidebar-nav a').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
    }

    // Refresh data if needed
    if (sectionId === 'clients' || sectionId === 'claims' || sectionId === 'revenus') {
        fetchCustomers();
    }
}

async function updateData() {
    try {
        const key = localStorage.getItem('admin_key');
        if (!key) return; // Don't fetch if no key

        const response = await fetch(`${API_BASE}/api/admin?action=stats`, {
            headers: { 'x-admin-key': key }
        });

        if (!response.ok) throw new Error('Unauthorized');

        const stats = await response.json();

        const elRevenue = document.getElementById('total-revenue');
        if (elRevenue) elRevenue.textContent = `${stats.revenue || 0}€`; // Use correct field from API

        const elSales = document.getElementById('total-sales');
        if (elSales) elSales.textContent = stats.customers || 0;

        const elClaims = document.getElementById('total-claims');
        if (elClaims) elClaims.textContent = stats.claims || 0;

        // Contract Balance & Address
        const elBalance = document.getElementById('contract-balance');
        if (elBalance) {
            elBalance.innerText = (stats.contractBalance || '0') + ' USDC';
            if (stats.contractBalance == "Error") elBalance.style.color = "red";
            else elBalance.style.color = "#00ff88";
        }

        const elAddress = document.getElementById('contract-address');
        if (elAddress && stats.contractAddress) {
            elAddress.innerText = stats.contractAddress;
        }

    } catch (e) {
        console.error("Update Data Error", e);
    }
}

async function fetchCustomers() {
    try {
        const key = localStorage.getItem('admin_key');
        if (!key) return;

        const response = await fetch(`${API_BASE}/api/admin?action=customers`, {
            headers: { 'x-admin-key': key }
        });

        const customers = await response.json();
        const tbody = document.getElementById('customers-table');

        if (!tbody) return;

        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">Aucun client pour le moment</td></tr>';
            return;
        }

        tbody.innerHTML = customers.map(c => `
<tr>
    <td>${maskEmail(c.email)}</td>
    <td><span class="badge badge-${c.pack}">${c.pack.toUpperCase()}</span></td>
    <td>${c.amount}€</td>
    <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
    <td>${c.claimed
                ? '<span class="badge badge-claimed">✓ Réclamé</span>'
                : '<span class="badge badge-pending">En attente</span>'}</td>
</tr>
`).join('');

        // Render Revenue Table using the same data
        renderRevenueTable(customers);

        // Claims table
        const claimedCustomers = customers.filter(c => c.claimed);
        const claimsTable = document.getElementById('claims-table');

        if (claimsTable) {
            if (claimedCustomers.length === 0) {
                claimsTable.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-secondary);">Aucun claim pour le moment</td></tr>';
            } else {
                claimsTable.innerHTML = claimedCustomers.map(c => `
                    <tr>
                        <td>${maskEmail(c.email)}</td>
                        <td>${shortenAddress(c.wallet_address || '0x...')}</td>
                        <td>${new Date(c.claimed_at).toLocaleDateString('fr-FR')}</td>
                        <td><a href="https://basescan.org/tx/${c.claim_tx_hash}" target="_blank" style="color: var(--accent-gold);">Voir TX</a></td>
                    </tr>
                `).join('');
            }
        }

    } catch (error) {
        console.error('Error fetching customers:', error);
    }
}

function renderRevenueTable(customers) {
    const tbody = document.getElementById('revenue-table');
    if (!tbody) return;

    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune transaction</td></tr>';
        return;
    }
    // Sort by date desc
    const sorted = [...customers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tbody.innerHTML = sorted.map(c => `
        <tr>
            <td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
            <td>${maskEmail(c.email)}</td>
            <td><span class="badge badge-${c.pack}">${c.pack ? c.pack.toUpperCase() : 'N/A'}</span></td>
            <td style="color: #00ff88; font-weight: bold;">+${c.amount}€</td>
            <td><span class="badge badge-claimed" style="background: rgba(0, 255, 136, 0.1); color: #00ff88;">Payé</span></td>
        </tr>
        `).join('');
}

function maskEmail(email) {
    if (!email) return '---';
    const [name, domain] = email.split('@');
    return `${name.charAt(0)}***@${domain}`;
}

function shortenAddress(address) {
    if (!address) return '---';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ========================================
// MOBILE SIDEBAR TOGGLE
// ========================================
function toggleAdminSidebar() {
    const sb = document.querySelector('.sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.toggle('open');
    if (ov) ov.classList.toggle('open');
}

// ========================================
// CHARTS - Sales & Visitors
// ========================================
let salesChart, visitorsChart;

const chartData = {
    sales: {
        '1h': { labels: ['00', '10', '20', '30', '40', '50', '60'], data: [0, 1, 0, 2, 1, 0, 1] },
        '24h': { labels: ['00h', '04h', '08h', '12h', '16h', '20h', '24h'], data: [2, 1, 4, 8, 12, 6, 3] },
        '1m': { labels: ['S1', 'S2', 'S3', 'S4'], data: [45, 52, 68, 74] },
        '1y': { labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'], data: [120, 145, 180, 210, 250, 320, 380, 420, 390, 450, 520, 580] }
    },
    visitors: {
        '1h': { labels: ['00', '10', '20', '30', '40', '50', '60'], data: [12, 18, 15, 22, 19, 25, 21] },
        '24h': { labels: ['00h', '04h', '08h', '12h', '16h', '20h', '24h'], data: [45, 23, 67, 120, 180, 95, 58] },
        '1m': { labels: ['S1', 'S2', 'S3', 'S4'], data: [1200, 1450, 1680, 1920] },
        '1y': { labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'], data: [4500, 5200, 6100, 7400, 8900, 11200, 13500, 15800, 14200, 16500, 18900, 21500] }
    }
};

function initCharts() {
    if (typeof Chart === 'undefined') return;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#a0a0b0' }
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#a0a0b0' },
                beginAtZero: true
            }
        }
    };

    // Sales Chart
    const salesCtxEl = document.getElementById('salesChart');
    if (salesCtxEl) {
        const salesCtx = salesCtxEl.getContext('2d');
        salesChart = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: chartData.sales['1h'].labels,
                datasets: [{
                    label: 'Ventes',
                    data: chartData.sales['1h'].data,
                    borderColor: '#f7931a',
                    backgroundColor: 'rgba(247, 147, 26, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#f7931a'
                }]
            },
            options: chartOptions
        });
    }

    // Visitors Chart
    const visitorsCtxEl = document.getElementById('visitorsChart');
    if (visitorsCtxEl) {
        const visitorsCtx = visitorsCtxEl.getContext('2d');
        visitorsChart = new Chart(visitorsCtx, {
            type: 'line',
            data: {
                labels: chartData.visitors['1h'].labels,
                datasets: [{
                    label: 'Visites',
                    data: chartData.visitors['1h'].data,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#00ff88'
                }]
            },
            options: chartOptions
        });
    }

    // Tab click handlers
    document.querySelectorAll('.chart-tabs').forEach(tabs => {
        tabs.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const chartType = tabs.dataset.chart;
                const period = btn.dataset.period;

                // Update active tab
                tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update chart data
                const data = chartData[chartType][period];
                const chart = chartType === 'sales' ? salesChart : visitorsChart;

                if (chart) {
                    chart.data.labels = data.labels;
                    chart.data.datasets[0].data = data.data;
                    chart.update('none');
                }
            });
        });
    });
}

// ========================================
// LIVE VISITORS SIMULATION
// ========================================
let currentVisitors = Math.floor(Math.random() * 10) + 5;

function updateVisitorsDisplay() {
    const elCount = document.getElementById('visitors-count');
    const elDisplay = document.getElementById('visitors-display');
    if (elCount) elCount.textContent = currentVisitors;
    if (elDisplay) elDisplay.textContent = currentVisitors;
}

function simulateVisitors() {
    const change = Math.floor(Math.random() * 6) - 2;
    currentVisitors = Math.max(3, Math.min(25, currentVisitors + change));
    updateVisitorsDisplay();

    if (visitorsChart && document.querySelector('.chart-tabs[data-chart="visitors"] .active').dataset.period === '1h') {
        const lastIdx = visitorsChart.data.datasets[0].data.length - 1;
        visitorsChart.data.datasets[0].data[lastIdx] = currentVisitors;
        visitorsChart.update('none');
    }

    const nextUpdate = Math.floor(Math.random() * 5000) + 3000;
    setTimeout(simulateVisitors, nextUpdate);
}
