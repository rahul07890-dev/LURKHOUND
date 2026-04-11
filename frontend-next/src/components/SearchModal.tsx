'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSession } from '@/context/SessionContext'
import { useRouter } from 'next/navigation'
import { Search, X, User, Users, Monitor, Shield, AlertTriangle, Route } from 'lucide-react'
import clsx from 'clsx'

type SearchResult = {
    type: 'object' | 'finding' | 'path' | 'mitre'
    icon: any
    title: string
    subtitle: string
    href?: string
    action?: () => void
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { session } = useSession()
    const router = useRouter()
    const [query, setQuery] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 100) }
    }, [open])

    // Keyboard handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (!open) onClose() }
            if (e.key === 'Escape' && open) onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onClose])

    const results = useMemo<SearchResult[]>(() => {
        if (!query.trim() || !session) return []
        const q = query.toLowerCase()
        const items: SearchResult[] = []

        // Search objects
        const allObjs = [...(session.users || []), ...(session.groups || []), ...(session.computers || [])]
        for (const obj of allObjs) {
            const sam = obj.sam_account_name || ''
            const name = obj.display_name || ''
            if (sam.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
                const Icon = obj.object_type === 'User' ? User : obj.object_type === 'Group' ? Users : Monitor
                items.push({
                    type: 'object',
                    icon: Icon,
                    title: sam,
                    subtitle: `${obj.object_type} · ${name}`,
                    href: '/dashboard/objects',
                })
            }
            if (items.length >= 20) break
        }

        // Search findings
        for (const f of session.findings || []) {
            if (f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)) {
                items.push({
                    type: 'finding',
                    icon: AlertTriangle,
                    title: f.title,
                    subtitle: `${f.severity} finding`,
                    href: '/dashboard/findings',
                })
            }
            if (items.length >= 25) break
        }

        // Search attack paths
        for (const p of session.attack_paths || []) {
            if (p.chain?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)) {
                items.push({
                    type: 'path',
                    icon: Route,
                    title: `${p.source} → ${p.target}`,
                    subtitle: `${p.severity} · ${p.path_type}`,
                    href: '/dashboard/paths',
                })
            }
            if (items.length >= 30) break
        }

        // Search MITRE techniques
        const seenMitre = new Set<string>()
        for (const f of session.findings || []) {
            for (const t of f.mitre_techniques || []) {
                if (seenMitre.has(t.id)) continue
                if (t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) {
                    seenMitre.add(t.id)
                    items.push({
                        type: 'mitre',
                        icon: Shield,
                        title: `${t.id} — ${t.name}`,
                        subtitle: t.tactic,
                        action: () => window.open(t.url, '_blank'),
                    })
                }
                if (items.length >= 35) break
            }
        }

        return items
    }, [query, session])

    if (!open) return null

    return (
        <>
            <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
            <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 animate-fade-in">
                <div className="bg-bg-card border border-bg-border rounded-xl shadow-2xl overflow-hidden">
                    {/* Search input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-bg-border">
                        <Search size={16} className="text-ink-muted" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search objects, findings, paths, MITRE techniques..."
                            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/50"
                        />
                        <kbd className="text-[10px] text-ink-muted bg-bg-raised px-1.5 py-0.5 rounded border border-bg-border font-mono">ESC</kbd>
                    </div>

                    {/* Results */}
                    <div className="max-h-80 overflow-y-auto">
                        {results.length === 0 && query.trim() && (
                            <div className="p-8 text-center text-ink-muted text-sm">No results found</div>
                        )}
                        {results.map((r, i) => {
                            const Icon = r.icon
                            return (
                                <button
                                    key={i}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-raised/60 transition-colors text-left"
                                    onClick={() => {
                                        if (r.action) r.action()
                                        else if (r.href) router.push(r.href)
                                        onClose()
                                    }}
                                >
                                    <Icon size={14} className="text-ink-muted flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-ink truncate">{r.title}</p>
                                        <p className="text-xs text-ink-muted truncate">{r.subtitle}</p>
                                    </div>
                                    <span className={clsx(
                                        'text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded',
                                        r.type === 'object' ? 'bg-red-500/10 text-red-400'
                                            : r.type === 'finding' ? 'bg-orange-500/10 text-orange-400'
                                                : r.type === 'path' ? 'bg-amber-500/10 text-amber-400'
                                                    : 'bg-red-500/10 text-red-300'
                                    )}>{r.type}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </>
    )
}
