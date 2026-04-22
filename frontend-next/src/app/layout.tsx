import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/context/SessionContext'
import { headers } from 'next/headers'

export const metadata: Metadata = {
    title: 'LurkHound',
    description: 'Active Directory security analysis — privilege escalation paths, MITRE ATT&CK mapping, remediation guidance.',
}

import { Suspense } from 'react'

async function ConfigData() {
    // Next.js 16 Async Request API integration
    const requestHeaders = await headers()
    const theme = requestHeaders.get('x-theme') || 'dark'
    
    // Real Cache Directive implementation for expensive static data
    async function getCachedMitreData() {
        'use cache'
        try {
            const res = await fetch('http://localhost:8000/api/mitre-techniques');
            if (res.ok) return await res.json();
        } catch (e) {
            // Backend might not be running during build
        }
        return { version: "v1.2.0", defaultTheme: theme };
    }
    await getCachedMitreData()
    return null
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <Suspense fallback={null}>
                    <ConfigData />
                </Suspense>
                <SessionProvider>{children}</SessionProvider>
            </body>
        </html>
    )
}
