/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Ensure we don't have issues with the root lockfile confusion
    distDir: '.next',
}

module.exports = nextConfig
