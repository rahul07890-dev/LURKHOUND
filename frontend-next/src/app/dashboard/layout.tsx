'use client'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import SearchModal from '@/components/SearchModal'
import ObjectDrawer from '@/components/ObjectDrawer'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'
import { AboutModal } from '@/components/AboutModal'
import { OnboardingTour } from '@/components/OnboardingTour'
import { useSession } from '@/context/SessionContext'
import { Info } from 'lucide-react'
import PantherIcon from '@/components/PantherIcon'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { session } = useSession()
    const [searchOpen, setSearchOpen] = useState(false)
    const [drawerNode, setDrawerNode] = useState<any>(null)
    const [aboutOpen, setAboutOpen] = useState(false)

    const openSearch = useCallback(() => setSearchOpen(true), [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setSearchOpen(true)
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault()
                // Trigger report download
                import('@/lib/api').then(({ downloadReport }) => downloadReport('html').catch(() => {}))
            }
            if (e.key === 'Escape') {
                setSearchOpen(false)
                setDrawerNode(null)
                setAboutOpen(false)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Global event for opening drawer from anywhere
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            setDrawerNode(detail)
        }
        window.addEventListener('open-object-drawer', handler)
        return () => window.removeEventListener('open-object-drawer', handler)
    }, [])

    const domain = session?.summary?.domain || 'N/A'
    const ip = session?.summary?.dc_ip || 'N/A'
    const riskScore = session?.summary?.risk_score ?? null

    return (
        <ToastProvider>
            <OnboardingTour>
                <div className="flex h-screen overflow-hidden bg-bg-base tactical-grid">
                    <Sidebar onSearch={openSearch} onAbout={() => setAboutOpen(true)} />

                    <div className="flex-1 ml-[56px] flex flex-col min-h-0 dashboard-main">
                        {/* ── Command Bar ── */}
                        <header className="command-bar mx-3 mt-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <PantherIcon size={16} className="text-accent" />
                                <span className="text-sm font-bold uppercase tracking-wider text-ink">
                                    LurkHound
                                </span>
                            </div>
                            <div className="h-4 w-px bg-bg-border" />
                            <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                                {domain} // {ip}
                            </span>

                            <div className="flex-1" />

                            {/* About button */}
                            <button onClick={() => setAboutOpen(true)}
                                title="About LurkHound"
                                className="text-ink-muted hover:text-ink transition-colors mr-2">
                                <Info size={14} />
                            </button>

                            {/* Threat level */}
                            {riskScore !== null && (
                                <div className={`threat-indicator ${riskScore >= 70 ? 'threat-critical' : 'threat-standby'}`}>
                                    <span className={`pulse-dot ${riskScore >= 70 ? 'pulse-dot-red' : 'pulse-dot-amber'}`} />
                                    {riskScore >= 70 ? 'CRITICAL_THREAT' : riskScore >= 40 ? 'ELEVATED' : 'NOMINAL'}
                                </div>
                            )}
                        </header>

                        {/* ── Main content ── */}
                        <main className="flex-1 overflow-y-auto p-3">
                            <ErrorBoundary>
                                {children}
                            </ErrorBoundary>
                        </main>

                        {/* ── Status Bar ── */}
                        <footer className="status-bar flex-shrink-0">
                            <span className="text-accent">
                                SYSTEM_READY // SECURE_CONNECTION_ESTABLISHED
                            </span>
                            <div className="flex items-center gap-4">
                                <span>LATENCY: 14MS</span>
                                <span>ENCRYPTION: AES-256</span>
                                <span className="pulse-dot pulse-dot-red" />
                            </div>
                        </footer>
                    </div>

                    {searchOpen && <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
                    {drawerNode && <ObjectDrawer objectName={drawerNode} onClose={() => setDrawerNode(null)} />}
                    <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
                </div>
            </OnboardingTour>
        </ToastProvider>
    )
}
