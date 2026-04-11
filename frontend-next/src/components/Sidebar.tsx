'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    LayoutGrid, Search, Network, GitFork, AlertTriangle,
    FolderTree, Power, FileDown, Download, Sun, Moon, Clock, Info
} from 'lucide-react'
import { downloadReport, downloadBloodHoundExport } from '@/lib/api'
import PantherIcon from '@/components/PantherIcon'
import { useSession } from '@/context/SessionContext'
import NotificationBell from '@/components/NotificationBell'
import clsx from 'clsx'
import { useState, useEffect } from 'react'

const navItems = [
    { href: '/dashboard/overview', icon: LayoutGrid, label: 'Overview' },
    { href: '/dashboard/objects', icon: Search, label: 'Objects' },
    { href: '/dashboard/graph', icon: Network, label: 'Graph' },
    { href: '/dashboard/paths', icon: GitFork, label: 'Paths' },
    { href: '/dashboard/findings', icon: AlertTriangle, label: 'Findings' },
    { href: '/dashboard/ou-tree', icon: FolderTree, label: 'OU Tree' },
    { href: '/dashboard/history', icon: Clock, label: 'History' },
]

export default function Sidebar({ onSearch, onAbout }: { onSearch: () => void; onAbout?: () => void }) {
    const pathname = usePathname()
    const router = useRouter()
    const { session } = useSession()
    const [theme, setTheme] = useState('dark')

    useEffect(() => {
        const saved = localStorage.getItem('lurkhound_theme') || 'dark'
        setTheme(saved)
        document.documentElement.setAttribute('data-theme', saved)
    }, [])

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('lurkhound_theme', theme)
    }, [theme])

    const logout = () => {
        router.push('/')
    }

    return (
        <nav className="sidebar" aria-label="Main navigation">
            {/* Logo */}
            <div className="flex items-center justify-center py-4 mb-2">
                <div className="w-8 h-8 rounded-md bg-accent/10 border border-accent/30 
                    flex items-center justify-center">
                    <PantherIcon size={18} className="text-red-500" />
                </div>
            </div>

            {/* Nav items */}
            <div className="flex flex-col items-center gap-1.5 px-2 flex-1">
                {navItems.map(item => {
                    const active = pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            className={clsx('nav-item', active && 'active')}
                        >
                            <item.icon size={18} />
                        </Link>
                    )
                })}

                {/* Separator */}
                <div className="w-6 my-2 border-t border-bg-border" />

                {/* Actions */}
                <button onClick={onSearch} title="Search (Ctrl+K)" className="nav-item">
                    <Search size={16} />
                </button>
                <button
                    onClick={() => downloadReport()}
                    title="Download Report"
                    className="nav-item"
                >
                    <FileDown size={16} />
                </button>
                <button
                    onClick={() => downloadBloodHoundExport()}
                    title="Export BloodHound"
                    className="nav-item"
                >
                    <Download size={16} />
                </button>
            </div>

            {/* Bottom section */}
            <div className="flex flex-col items-center gap-1.5 px-2 pb-4">
                <NotificationBell />

                {/* Risk pill */}
                {session?.summary?.risk_score != null && (
                    <div
                        title={`Risk: ${session.summary.risk_score}/100`}
                        className="flex items-center justify-center w-8 h-5 rounded-sm 
                            text-[10px] font-mono font-bold"
                        style={{
                            background: session.summary.risk_score >= 70
                                ? 'rgba(239,68,68,0.15)' : session.summary.risk_score >= 40
                                    ? 'rgba(255,185,95,0.15)' : 'rgba(34,197,94,0.15)',
                            color: session.summary.risk_score >= 70
                                ? '#ef4444' : session.summary.risk_score >= 40
                                    ? '#ffb95f' : '#22c55e',
                            border: `1px solid ${session.summary.risk_score >= 70
                                ? 'rgba(239,68,68,0.3)' : session.summary.risk_score >= 40
                                    ? 'rgba(255,185,95,0.3)' : 'rgba(34,197,94,0.3)'}`
                        }}
                    >
                        {session.summary.risk_score}
                    </div>
                )}

                {/* About */}
                {onAbout && (
                    <button onClick={onAbout} title="About LurkHound" className="nav-item">
                        <Info size={16} />
                    </button>
                )}

                {/* Theme toggle */}
                <button
                    onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                    title="Toggle Theme"
                    className="nav-item"
                >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>

                {/* Disconnect */}
                <button
                    onClick={logout}
                    title="Disconnect"
                    className="nav-item text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                    <Power size={16} />
                </button>
            </div>
        </nav>
    )
}
