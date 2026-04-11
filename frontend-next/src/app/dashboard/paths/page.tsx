'use client'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSession } from '@/context/SessionContext'
import { AttackPath, PathEdge } from '@/lib/api'
import { Filter, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

// Path type → label & color
const PATH_META: Record<string, { label: string; color: string }> = {
    dcsync_risk: { label: 'DCSync / Golden Ticket', color: '#ef4444' },
    admin_to_dc: { label: 'Admin to DC', color: '#ef4444' },
    admin_to_workstation: { label: 'Lateral Movement', color: '#f97316' },
    kerberoast_escalation: { label: 'Kerberoasting', color: '#eab308' },
    generic_all_abuse: { label: 'GenericAll Abuse', color: '#ef4444' },
    write_dacl_abuse: { label: 'WriteDACL Abuse', color: '#f97316' },
    write_owner_abuse: { label: 'WriteOwner Abuse', color: '#f97316' },
    generic_write_abuse: { label: 'GenericWrite Abuse', color: '#eab308' },
    nested_group_da_escalation: { label: 'Nested Group to DA', color: '#ffb95f' },
    user_to_domain_admin: { label: 'Privilege Escalation', color: '#ef4444' },
    unconstrained_delegation: { label: 'Unconstrained Delegation', color: '#eab308' },
    stale_privileged_credential: { label: 'Stale Credentials', color: '#f97316' },
}

const NODE_STYLES: Record<string, { bg: string; border: string; shape: string }> = {
    User: { bg: '#2a1a1a', border: '#ef4444', shape: 'ellipse' },
    Group: { bg: '#2a2215', border: '#ffb95f', shape: 'round-rectangle' },
    Computer: { bg: '#0f2a26', border: '#2dd4bf', shape: 'diamond' },
    Unknown: { bg: '#1a1c20', border: '#86948a', shape: 'ellipse' },
}

const EDGE_PALETTE: Record<string, string> = {
    AdminTo: '#ef4444', GenericAll: '#ef4444', WriteDACL: '#eab308',
    WriteOwner: '#f97316', GenericWrite: '#f97316', MemberOf: '#ef4444',
    ForceChangePassword: '#ef4444', StaleCredential: '#86948a',
    default: '#3c4a42',
}

function SevBadge({ sev }: { sev: string }) {
    const cls: Record<string, string> = {
        Critical: 'badge-critical', High: 'badge-high',
        Medium: 'badge-medium', Low: 'badge-low',
    }
    return <span className={cls[sev] ?? 'badge-low'}>{sev}</span>
}

function PathTypeBadge({ pathType }: { pathType: string }) {
    const m = PATH_META[pathType]
    if (!m) return null
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
            style={{ color: m.color, background: `${m.color}18`, borderColor: `${m.color}40` }}
        >
            {m.label}
        </span>
    )
}

/* ── Interactive Cytoscape path graph ────────────────────────── */
function PathGraph({ edges }: { edges: PathEdge[] }) {
    const containerRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cyRef = useRef<any>(null)

    useEffect(() => {
        if (!edges?.length || !containerRef.current) return

        let cancelled = false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let localCy: any = null

        if (cyRef.current) { try { cyRef.current.destroy() } catch { /* */ } cyRef.current = null }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        try { const el = containerRef.current as any; if (el._private) delete el._private } catch { /* */ }

        import('cytoscape').then(({ default: Cytoscape }) => {
            if (cancelled || !containerRef.current) return
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            try { const el2 = containerRef.current as any; if (el2._private) delete el2._private } catch { /* */ }

            // Build unique nodes from edges
            const nodeMap = new Map<string, string>()
            edges.forEach(e => {
                if (!nodeMap.has(e.from)) nodeMap.set(e.from, e.from_type || 'Unknown')
                if (!nodeMap.has(e.to)) nodeMap.set(e.to, e.to_type || 'Unknown')
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const elements: any[] = []
            nodeMap.forEach((type, id) => {
                const s = NODE_STYLES[type] || NODE_STYLES.Unknown
                elements.push({
                    data: {
                        id, label: id, type,
                        _bg: s.bg, _border: s.border, _shape: s.shape,
                    }
                })
            })
            edges.forEach((e, i) => {
                elements.push({
                    data: {
                        id: `pe${i}`, source: e.from, target: e.to,
                        label: e.type,
                        _color: EDGE_PALETTE[e.type] || EDGE_PALETTE.default,
                    }
                })
            })

            try {
                localCy = Cytoscape({
                    container: containerRef.current,
                    elements,
                    style: [
                        {
                            selector: 'node',
                            style: {
                                'background-color': 'data(_bg)',
                                'border-color': 'data(_border)',
                                'border-width': 2,
                                label: 'data(label)',
                                color: 'data(_border)',
                                'text-valign': 'bottom',
                                'text-halign': 'center',
                                'font-size': '12px',
                                'font-family': '"JetBrains Mono", monospace',
                                'font-weight': '600',
                                'text-margin-y': 8,
                                'text-wrap': 'ellipsis',
                                'text-max-width': '120px',
                                width: 54, height: 54,
                                shape: 'data(_shape)',
                                'background-opacity': 1,
                            } as any,
                        },
                        {
                            selector: 'edge',
                            style: {
                                'curve-style': 'bezier',
                                'target-arrow-shape': 'triangle',
                                'line-color': 'data(_color)',
                                'target-arrow-color': 'data(_color)',
                                width: 2,
                                label: 'data(label)',
                                'font-size': '10px',
                                'font-family': '"JetBrains Mono", monospace',
                                color: '#94a3b8',
                                'text-background-color': '#0b0e17',
                                'text-background-opacity': 0.9,
                                'text-background-padding': '3px',
                                opacity: 0.85,
                            },
                        },
                    ],
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    layout: {
                        name: 'breadthfirst',
                        directed: true,
                        padding: 30,
                        spacingFactor: 2.0,
                        avoidOverlap: true,
                        animate: false,
                    } as any,
                    userZoomingEnabled: true,
                    userPanningEnabled: true,
                    boxSelectionEnabled: false,
                    minZoom: 0.3,
                    maxZoom: 5,
                })

                // Delay fit so the flex container has resolved h-full
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        if (localCy && !cancelled) {
                            localCy.resize()
                            localCy.fit(undefined, 40)
                            // Animate nodes in after fit
                            localCy.nodes().forEach((n: any, i: number) => {
                                n.style({ opacity: 0 })
                                setTimeout(() => n.animate({ style: { opacity: 1 } }, { duration: 200 }), i * 100)
                            })
                        }
                    }, 100)
                })

                cyRef.current = localCy
            } catch (err) { console.error('[PathGraph] init:', err) }
        }).catch(err => console.error('[PathGraph] import:', err))

        return () => {
            cancelled = true
            if (localCy) { try { localCy.destroy() } catch { /* */ } }
            cyRef.current = null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            try { const el3 = containerRef.current as any; if (el3?._private) delete el3._private } catch { /* */ }
        }
    }, [edges])

    return (
        <div
            ref={containerRef}
            className="w-full h-full rounded-lg border border-[#151a2a]"
            style={{ minHeight: 260, background: '#0b0e17' }}
        />
    )
}

/* ── Kill chain (CSS fallback) ───────────────────────────────── */
function KillChain({ edges }: { edges: PathEdge[] }) {
    if (!edges.length) return null
    const NODE_COLORS: Record<string, string> = {
        User: '#4f9cf9', Group: '#a855f7', Computer: '#2dd4bf', Unknown: '#64748b',
    }

    // Build ordered chain: [source] → edge → [target] → edge → [target] ...
    const sourceType = edges[0]?.from_type ?? 'Unknown'
    const sourceColor = NODE_COLORS[sourceType] ?? '#64748b'

    return (
        <div className="kc-chain">
            {/* Source node */}
            <div className="kc-node" style={{ borderColor: sourceColor, color: sourceColor }}>
                <span className="kc-node-type">{sourceType}</span>
                <span className="kc-node-name">{edges[0].from}</span>
            </div>

            {edges.map((e, i) => {
                const ec = EDGE_PALETTE[e.type] ?? '#64748b'
                const nc = NODE_COLORS[e.to_type] ?? '#64748b'
                return (
                    <div key={i} className="kc-step">
                        {/* Arrow connector */}
                        <div className="kc-connector">
                            <div className="kc-connector-line" style={{ background: ec }} />
                            <svg width="8" height="12" viewBox="0 0 8 12" className="kc-connector-arrow" style={{ fill: ec }}>
                                <path d="M0 0 L8 6 L0 12 Z" />
                            </svg>
                        </div>
                        <span className="kc-edge-label" style={{ color: ec }}>{e.type}</span>
                        <div className="kc-connector">
                            <div className="kc-connector-line" style={{ background: ec }} />
                            <svg width="8" height="12" viewBox="0 0 8 12" className="kc-connector-arrow" style={{ fill: ec }}>
                                <path d="M0 0 L8 6 L0 12 Z" />
                            </svg>
                        </div>

                        {/* Target node */}
                        <div className="kc-node" style={{ borderColor: nc, color: nc }}>
                            <span className="kc-node-type">{e.to_type}</span>
                            <span className="kc-node-name">{e.to}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/* ── Main page ───────────────────────────────────────────────── */
const ALL_TYPES = [
    { value: 'ALL', label: 'All Types' },
    ...Object.entries(PATH_META).map(([v, m]) => ({ value: v, label: m.label })),
]
const SEVERITIES = ['ALL', 'Critical', 'High', 'Medium', 'Low']

export default function PathsPage() {
    const { session } = useSession()
    const [sevFilter, setSevFilter] = useState('ALL')
    const [typeFilter, setTypeFilter] = useState('ALL')
    const [selected, setSelected] = useState<AttackPath | null>(null)

    const paths = session?.attack_paths ?? []

    const filtered = useMemo(() => paths.filter(p =>
        (sevFilter === 'ALL' || p.severity === sevFilter) &&
        (typeFilter === 'ALL' || p.path_type === typeFilter)
    ), [paths, sevFilter, typeFilter])

    return (
        <div className="flex gap-5 h-[calc(100vh-3rem)]">
            {/* Left: list */}
            <div className="w-80 flex-shrink-0 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-ink">Attack Paths</h2>
                    <span className="text-xs text-ink-muted">{filtered.length} paths</span>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                        <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                        <select
                            value={sevFilter}
                            onChange={e => setSevFilter(e.target.value)}
                            className="input pl-7 text-xs py-1.5 appearance-none"
                        >
                            {SEVERITIES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Severities' : s}</option>)}
                        </select>
                    </div>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="input text-xs py-1.5 appearance-none"
                    >
                        {ALL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {filtered.map((p, i) => (
                        <button
                            key={i}
                            onClick={() => setSelected(p)}
                            className={clsx(
                                'w-full text-left card-sm cursor-pointer transition-colors hover:border-bg-border/80',
                                selected === p && 'border-accent/50 bg-accent-muted'
                            )}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <SevBadge sev={p.severity} />
                                <PathTypeBadge pathType={p.path_type} />
                                <span className="ml-auto text-[10px] text-ink-muted">
                                    {p.length === 0 ? 'Config' : `${p.length} hop${p.length !== 1 ? 's' : ''}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-mono font-semibold text-blue-400">{p.source}</span>
                                <ChevronRight size={10} className="text-ink-muted" />
                                <span className="text-xs font-mono font-semibold text-red-400">{p.target}</span>
                            </div>
                            <p className="text-[11px] text-ink-muted line-clamp-2 leading-relaxed">{p.description}</p>
                            {p.mitre_techniques?.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                    {p.mitre_techniques.slice(0, 2).map(t => (
                                        <span key={t.id} className="badge-mitre">{t.id}</span>
                                    ))}
                                </div>
                            )}
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-ink-muted text-sm">
                            No paths match filter
                        </div>
                    )}
                </div>
            </div>

            {/* Right: detail */}
            <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-3">
                {selected ? (
                    <>
                        {/* Header + Description */}
                        <div className="card">
                            <div className="flex items-start gap-3 mb-3">
                                <SevBadge sev={selected.severity} />
                                <PathTypeBadge pathType={selected.path_type} />
                                <span className="ml-auto text-xs text-ink-muted">
                                    {selected.length === 0 ? 'Configuration Risk' : `${selected.length}-hop path`}
                                </span>
                            </div>
                            <p className="text-sm text-ink-subtle leading-relaxed">{selected.description}</p>
                        </div>

                        {/* Side-by-side: Attack Chain (left) + Path Graph (right) */}
                        <div className="flex gap-3 min-h-[260px]">
                            {/* Left: Attack Chain */}
                            <div className="card flex-1 min-w-0 flex flex-col">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-3">
                                    Attack Chain
                                </p>
                                <div className="flex-1 flex items-center">
                                    {selected.edges?.length > 0 ? (
                                        <KillChain edges={selected.edges} />
                                    ) : (
                                        <div className="kc-node border-yellow-500/50 text-yellow-400">
                                            <span className="kc-node-type">Object</span>
                                            <span className="kc-node-name">{selected.source || selected.target}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Interactive Cytoscape Graph */}
                            {selected.edges?.length > 0 && (
                                <div className="flex-1 min-w-0">
                                    <PathGraph edges={selected.edges} />
                                </div>
                            )}
                        </div>

                        {/* MITRE ATT&CK */}
                        {selected.mitre_techniques?.length > 0 && (
                            <div className="card">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-3">
                                    MITRE ATT&amp;CK
                                </p>
                                <div className="space-y-2">
                                    {selected.mitre_techniques.map(t => (
                                        <a
                                            key={t.id}
                                            href={t.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-start gap-3 p-2.5 rounded-md bg-bg-raised border border-bg-border hover:border-purple-500/30 transition-colors group"
                                        >
                                            <span className="badge-mitre mt-0.5">{t.id}</span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-ink group-hover:text-purple-300 transition-colors">
                                                    {t.name}
                                                </p>
                                                <p className="text-xs text-ink-muted mt-0.5">{t.tactic}</p>
                                                <p className="text-xs text-ink-subtle mt-1 line-clamp-2">{t.description}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 card flex flex-col items-center justify-center text-ink-muted">
                        <GitForkIcon />
                        <p className="mt-3 text-sm">Select an attack path from the list</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function GitForkIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
            <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" /><line x1="12" y1="12" x2="12" y2="15" />
        </svg>
    )
}
