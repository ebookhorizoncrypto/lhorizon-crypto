/* ========================================
   L'HORIZON CRYPTO - Three.js Effects
   Premium Web3 Landing Page with Crypto Logos
======================================== */

// Initialize Three.js Scene
const canvas = document.getElementById('threejs-canvas');
let scene, camera, renderer;
let particles, particlesMaterial;
let mouseX = 0, mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

// Color palette matching our design
const COLORS = {
    gold: 0xf7931a,
    purple: 0x9945ff,
    cyan: 0x00d4ff,
    green: 0x00ff88,
    blue: 0x627eea,
    bnb: 0xf3ba2f,
    solana: 0x14f195
};

// Crypto logos as SVG data URLs
const CRYPTO_LOGOS = {
    bitcoin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#f7931a"/><path fill="#fff" d="M22.5 14.1c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.6c-.4-.1-.9-.2-1.3-.3l.7-2.7-1.6-.4-.7 2.7c-.3-.1-.7-.2-1-.2v-.1l-2.2-.6-.5 1.7s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.1c0 0 .1 0 .2.1h-.2l-1.1 4.4c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.8 2.1.5c.4.1.8.2 1.2.3l-.7 2.8 1.6.4.7-2.7c.4.1.9.2 1.3.3l-.7 2.7 1.6.4.7-2.8c2.9.5 5.1.3 6-2.3.7-2.1-.1-3.3-1.5-4.1 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2.1-4.1 1-5.2.7l.9-3.7c1.2.3 4.9.9 4.3 3zm.6-5.4c-.5 1.9-3.4.9-4.4.7l.8-3.4c1 .2 4.1.7 3.6 2.7z"/></svg>`,

    ethereum: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#627eea"/><path fill="#fff" fill-opacity=".6" d="M16 4v8.9l7.5 3.3z"/><path fill="#fff" d="M16 4L8.5 16.2l7.5-3.3z"/><path fill="#fff" fill-opacity=".6" d="M16 21.9v6.1l7.5-10.4z"/><path fill="#fff" d="M16 28V21.9L8.5 17.6z"/><path fill="#fff" fill-opacity=".2" d="M16 20.4l7.5-4.2L16 13z"/><path fill="#fff" fill-opacity=".6" d="M8.5 16.2l7.5 4.2V13z"/></svg>`,

    bnb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#f3ba2f"/><path fill="#fff" d="M12.1 14.4L16 10.5l3.9 3.9 2.3-2.3L16 5.9l-6.2 6.2zm-6.2 1.6l2.3-2.3 2.3 2.3-2.3 2.3zm6.2 1.6L16 21.5l3.9-3.9 2.3 2.3-6.2 6.2-6.2-6.2zm10-1.6l2.3-2.3 2.3 2.3-2.3 2.3zM18.3 16L16 13.7 14.2 15.5l-.2.2-.3.3L16 18.3 18.3 16z"/></svg>`,

    solana: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="url(#solana-grad)"/><defs><linearGradient id="solana-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00FFA3"/><stop offset="100%" style="stop-color:#DC1FFF"/></linearGradient></defs><path fill="#fff" d="M9.4 20.4c.1-.1.3-.2.5-.2h13c.2 0 .3.2.2.4l-2.2 2.2c-.1.1-.3.2-.5.2h-13c-.2 0-.3-.2-.2-.4l2.2-2.2zm0-8.8c.1-.1.3-.2.5-.2h13c.2 0 .3.2.2.4L21 14c-.1.1-.3.2-.5.2h-13c-.2 0-.3-.2-.2-.4l2.1-2.2zm11.3 4.2c-.1-.1-.3-.2-.5-.2h-13c-.2 0-.3.2-.2.4l2.2 2.2c.1.1.3.2.5.2h13c.2 0 .3-.2.2-.4l-2.2-2.2z"/></svg>`,

    polygon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#8247e5"/><path fill="#fff" d="M21.1 12.8c-.4-.2-.8-.2-1.2 0l-2.8 1.6-1.9 1.1-2.8 1.6c-.4.2-.8.2-1.2 0l-2.2-1.3c-.4-.2-.6-.6-.6-1v-2.5c0-.4.2-.8.6-1l2.2-1.2c.4-.2.8-.2 1.2 0l2.2 1.3c.4.2.6.6.6 1v1.6l1.9-1.1V11c0-.4-.2-.8-.6-1l-4-2.3c-.4-.2-.8-.2-1.2 0l-4.1 2.4c-.4.2-.6.6-.6 1v4.6c0 .4.2.8.6 1l4.1 2.3c.4.2.8.2 1.2 0l2.8-1.6 1.9-1.1 2.8-1.6c.4-.2.8-.2 1.2 0l2.2 1.2c.4.2.6.6.6 1v2.5c0 .4-.2.8-.6 1l-2.1 1.3c-.4.2-.8.2-1.2 0l-2.2-1.3c-.4-.2-.6-.6-.6-1v-1.5l-1.9 1.1v1.6c0 .4.2.8.6 1l4.1 2.3c.4.2.8.2 1.2 0l4.1-2.3c.4-.2.6-.6.6-1v-4.6c0-.4-.2-.8-.6-1l-4.2-2.4z"/></svg>`,

    avalanche: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#e84142"/><path fill="#fff" d="M18.4 20.8h3.3c.6 0 .9-.3 1.1-.8.2-.5.1-.9-.2-1.4l-6.8-12c-.3-.5-.7-.8-1.2-.8s-.9.3-1.2.8l-2 3.6c-.5.9-.5 2 0 2.9l4.3 7.5c.6 1 1.6.2 2.7.2zm-6.6 0h-2.6c-.6 0-.9-.3-1.1-.8s-.1-.9.2-1.4l1.3-2.3c.3-.5.7-.8 1.2-.8s.9.3 1.2.8l1.3 2.3c.3.5.3.9.2 1.4-.3.5-.6.8-1.1.8h-.6z"/></svg>`,

    cardano: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#0033ad"/><path fill="#fff" d="M16 8.5c-.4 0-.7.3-.7.7s.3.7.7.7.7-.3.7-.7-.3-.7-.7-.7zm0 13.6c-.4 0-.7.3-.7.7s.3.7.7.7.7-.3.7-.7-.3-.7-.7-.7zm6.8-6.8c0-.4-.3-.7-.7-.7s-.7.3-.7.7.3.7.7.7.7-.3.7-.7zm-13.6 0c0-.4-.3-.7-.7-.7s-.7.3-.7.7.3.7.7.7.7-.3.7-.7zm11.1-4.5a.5.5 0 100-1 .5.5 0 000 1zm-8.6 0a.5.5 0 100-1 .5.5 0 000 1zm8.6 9.4a.5.5 0 100-1 .5.5 0 000 1zm-8.6 0a.5.5 0 100-1 .5.5 0 000 1zM16 14c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,

    xrp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#23292f"/><path fill="#fff" d="M23.1 8h2.4l-5.7 5.6c-2.1 2-5.5 2-7.6 0L6.5 8h2.4l4.5 4.4c1.3 1.3 3.5 1.3 4.8 0L23.1 8zm-14.6 16H6l6-5.9c2.1-2 5.5-2 7.6 0l6 5.9h-2.5l-4.8-4.6c-1.3-1.3-3.5-1.3-4.8 0l-5 4.6z"/></svg>`
};

function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.z = 1000;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create Particles (stars)
    createParticles();

    // Create Floating Crypto Logos
    createCryptoLogos();

    // Create Connection Lines
    createConnectionLines();

    // Event Listeners
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);

    // Start Animation
    animate();
}

// Create Particle System (background stars)
function createParticles() {
    const particleCount = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorOptions = [
        new THREE.Color(COLORS.gold),
        new THREE.Color(COLORS.purple),
        new THREE.Color(COLORS.cyan),
        new THREE.Color(COLORS.blue)
    ];

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        positions[i3] = (Math.random() - 0.5) * 2500;
        positions[i3 + 1] = (Math.random() - 0.5) * 2500;
        positions[i3 + 2] = (Math.random() - 0.5) * 2000;

        const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    particlesMaterial = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    particles = new THREE.Points(geometry, particlesMaterial);
    scene.add(particles);
}

// Create Floating Crypto Logos
let cryptoSprites = [];

function createCryptoLogos() {
    const logoKeys = Object.keys(CRYPTO_LOGOS);
    const logoCount = 25; // Number of floating logos

    logoKeys.forEach((key, keyIndex) => {
        // Create texture from SVG
        const svgData = CRYPTO_LOGOS[key];
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);

        const loader = new THREE.TextureLoader();
        loader.load(url, (texture) => {
            // Create multiple instances of each logo
            const instanceCount = Math.ceil(logoCount / logoKeys.length);

            for (let i = 0; i < instanceCount; i++) {
                const spriteMaterial = new THREE.SpriteMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0.7,
                    blending: THREE.AdditiveBlending
                });

                const sprite = new THREE.Sprite(spriteMaterial);

                // Random size
                const size = Math.random() * 60 + 30;
                sprite.scale.set(size, size, 1);

                // Random position
                sprite.position.x = (Math.random() - 0.5) * 2000;
                sprite.position.y = (Math.random() - 0.5) * 2000;
                sprite.position.z = (Math.random() - 0.5) * 1000;

                // Animation data
                sprite.userData = {
                    floatSpeed: Math.random() * 0.3 + 0.1,
                    floatOffset: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.01,
                    originalY: sprite.position.y,
                    pulseSpeed: Math.random() * 2 + 1,
                    pulseOffset: Math.random() * Math.PI * 2
                };

                cryptoSprites.push(sprite);
                scene.add(sprite);
            }

            URL.revokeObjectURL(url);
        });
    });
}

// Create Connection Lines between elements (blockchain effect)
let connectionLines;
let linePositions;

function createConnectionLines() {
    const lineCount = 100;
    linePositions = new Float32Array(lineCount * 2 * 3);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
        color: COLORS.gold,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending
    });

    connectionLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(connectionLines);
}

// Update connection lines between nearby crypto logos
function updateConnectionLines() {
    if (cryptoSprites.length < 2) return;

    let lineIndex = 0;
    const maxDistance = 300;

    for (let i = 0; i < cryptoSprites.length && lineIndex < linePositions.length - 6; i++) {
        for (let j = i + 1; j < cryptoSprites.length && lineIndex < linePositions.length - 6; j++) {
            const sprite1 = cryptoSprites[i];
            const sprite2 = cryptoSprites[j];

            const dx = sprite1.position.x - sprite2.position.x;
            const dy = sprite1.position.y - sprite2.position.y;
            const dz = sprite1.position.z - sprite2.position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < maxDistance) {
                linePositions[lineIndex++] = sprite1.position.x;
                linePositions[lineIndex++] = sprite1.position.y;
                linePositions[lineIndex++] = sprite1.position.z;
                linePositions[lineIndex++] = sprite2.position.x;
                linePositions[lineIndex++] = sprite2.position.y;
                linePositions[lineIndex++] = sprite2.position.z;
            }
        }
    }

    // Clear remaining positions
    for (let i = lineIndex; i < linePositions.length; i++) {
        linePositions[i] = 0;
    }

    connectionLines.geometry.attributes.position.needsUpdate = true;
}

// Mouse Move Handler
function onMouseMove(event) {
    mouseX = (event.clientX - windowHalfX) * 0.5;
    mouseY = (event.clientY - windowHalfY) * 0.5;
}

// Window Resize Handler
function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // Rotate particles slowly
    if (particles) {
        particles.rotation.y += 0.0002;
        particles.rotation.x += 0.0001;
    }

    // Animate crypto sprites
    cryptoSprites.forEach((sprite, index) => {
        const data = sprite.userData;

        // Floating animation
        sprite.position.y = data.originalY + Math.sin(time * data.floatSpeed + data.floatOffset) * 30;

        // Gentle rotation
        sprite.material.rotation += data.rotationSpeed;

        // Pulse opacity
        const pulse = Math.sin(time * data.pulseSpeed + data.pulseOffset) * 0.2 + 0.6;
        sprite.material.opacity = pulse;
    });

    // Update connection lines
    updateConnectionLines();

    // Camera follows mouse with smooth interpolation
    camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    // Scroll-based movement
    const scrollY = window.scrollY;
    if (particles) {
        particles.position.y = scrollY * 0.2;
    }

    renderer.render(scene, camera);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    if (canvas) {
        init();
    }
});

// Animated counter for stats
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number[data-target]');

    counters.forEach(counter => {
        const target = parseInt(counter.dataset.target);
        const duration = 2000;
        const startTime = performance.now();

        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(easeOutQuart * target);

            counter.textContent = current.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = target.toLocaleString() + '+';
            }
        };

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                requestAnimationFrame(updateCounter);
                observer.disconnect();
            }
        });

        observer.observe(counter);
    });
}

animateCounters();

console.log('🌅 Three.js Effects with Crypto Logos Initialized - L\'Horizon Crypto');
