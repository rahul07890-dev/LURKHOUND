import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/context/SessionContext'
import { headers, cookies } from 'next/headers'

export const metadata: Metadata = {
    title: 'LurkHound',
    description: 'Active Directory security analysis — privilege escalation paths, MITRE ATT&CK mapping, remediation guidance.',
}

import { Suspense } from 'react'

async function ConfigData() {
    // Next.js 16 Async Request API integration
    const requestHeaders = await headers()
    const requestCookies = await cookies()
    const theme = requestHeaders.get('x-theme') || 'dark'
    
    // Simulate Cache Directive implementation
    async function getCachedConfig() {
        'use cache'
        return { version: "v1.2.0", defaultTheme: theme }
    }
    await getCachedConfig()
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
