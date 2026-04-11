import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/context/SessionContext'

export const metadata: Metadata = {
    title: 'LurkHound',
    description: 'Active Directory security analysis — privilege escalation paths, MITRE ATT&CK mapping, remediation guidance.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <SessionProvider>{children}</SessionProvider>
            </body>
        </html>
    )
}
