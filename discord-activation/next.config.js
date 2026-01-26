/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // Silence workspace root warning
        turbopack: {
            root: path.join(__dirname, '../../'),
        },
    },
}

module.exports = nextConfig
