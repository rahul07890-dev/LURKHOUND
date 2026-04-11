'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useSession } from '@/context/SessionContext'
import { Bell, AlertTriangle, Route, Shield, X } from 'lucide-react'
import clsx from 'clsx'

export default function NotificationBell() {
    const { session } = useSession()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [])

    const items = useMemo(() => {
        if (!session) return []
        const list: { icon: any; text: string; color: string; severity?: string }[] = []

        const critFindings = (session.findings || []).filter(f => f.severity === 'Critical')
        const highFindings = (session.findings || []).filter(f => f.severity === 'High')
        const critPaths = (session.attack_paths || []).filter(p => p.severity === 'Critical')

        if (critFindings.length > 0) {
            list.push({ icon: AlertTriangle, text: `${critFindings.length} critical finding(s)`, color: 'text-red-400', severity: 'Critical' })
        }
        if (highFindings.length > 0) {
            list.push({ icon: AlertTriangle, text: `${highFindings.length} high-severity finding(s)`, color: 'text-orange-400', severity: 'High' })
        }
        if (critPaths.length > 0) {
            list.push({ icon: Route, text: `${critPaths.length} critical attack path(s)`, color: 'text-red-400', severity: 'Critical' })
        }

        // Top 5 urgent items
        for (const f of critFindings.slice(0, 3)) {
            list.push({ icon: Shield, text: f.title, color: 'text-red-400' })
        }
        return list
    }, [session])

    const count = items.length

    return (
        <div ref={ref} className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
                className="relative p-2 rounded-md hover:bg-bg-raised transition-colors"
                aria-label="Notifications"
            >
                <Bell size={16} className="text-ink-muted" />
                {count > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {open && (
                <>
                    {/* Backdrop for mobile / click-away */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    {/* Dropdown — opens to the right on desktop, positioned so it doesn't clip */}
                    <div className="absolute left-full top-0 ml-2 w-80 bg-bg-card border border-bg-border rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in"
                        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)' }}>
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-bg-border bg-bg-raised/30">
                            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Alerts</span>
                            <span className="text-[10px] text-ink-muted">{count} total</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                            {items.length === 0 ? (
                                <div className="p-6 text-center text-ink-muted text-sm">No alerts</div>
                            ) : (
                                items.map((item, i) => {
                                    const Icon = item.icon
                                    return (
                                        <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-bg-raised/50 transition-colors border-b border-bg-border/30 last:border-0 cursor-default">
                                            <Icon size={13} className={clsx(item.color, 'mt-0.5 flex-shrink-0')} />
                                            <span className="text-xs text-ink-subtle leading-relaxed">{item.text}</span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

