/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            // Proxy all /api/* calls to the Python FastAPI backend
            {
                source: '/api/:path*',
                destination: 'http://localhost:8000/api/:path*',
            },
            // Also proxy /health which lives at root in FastAPI
            {
                source: '/health',
                destination: 'http://localhost:8000/health',
            },
        ]
    },
}

module.exports = nextConfig
