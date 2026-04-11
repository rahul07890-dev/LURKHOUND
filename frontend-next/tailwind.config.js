/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
                mono: ['Space Mono', 'JetBrains Mono', 'monospace'],
            },
            colors: {
                bg: {
                    base: '#0c0e12',
                    card: '#1a1c20',
                    raised: '#282a2e',
                    border: '#3c4a42',
                },
                ink: {
                    DEFAULT: '#e2e2e8',
                    muted: '#86948a',
                    subtle: '#bbcabf',
                },
                accent: {
                    DEFAULT: '#ef4444',
                    hover: '#dc2626',
                    muted: 'rgba(239,68,68,0.12)',
                    border: 'rgba(239,68,68,0.3)',
                },
                amber: {
                    DEFAULT: '#ffb95f',
                    muted: 'rgba(255,185,95,0.12)',
                    border: 'rgba(255,185,95,0.3)',
                },
                severity: {
                    critical: '#ef4444',
                    high: '#f97316',
                    medium: '#eab308',
                    low: '#22c55e',
                },
            },
            borderRadius: {
                sm: '6px',
                md: '8px',
                lg: '12px',
            },
            letterSpacing: {
                tactical: '0.15em',
            },
        },
    },
    plugins: [],
}
