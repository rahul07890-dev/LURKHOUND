'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from '@/context/SessionContext'
import { Maximize2, RotateCcw, Search, X, Shield, Monitor, Users, User, Eye, EyeOff } from 'lucide-react'

/* ── Layouts ────────────────────────────────────────────────────── */
const LAYOUTS = [
    { value: 'breadthfirst', label: 'Hierarchy' },
    { value: 'cose', label: 'Force‑Directed' },
    { value: 'circle', label: 'Circle' },
    { value: 'concentric', label: 'Concentric' },
]

/* ── Colour palette (matches reference) ─────────────────────────── */
const PAL = {
    bg: '#0c0e12',
    user: '#ef4444',       // red
    group: '#ffb95f',      // amber
    computer: '#22d3ee',   // cyan-diamond
    dc: '#f97316',         // orange star
    hvt: '#ef4444',        // red
    admin: '#f97316',      // orange
    unknown: '#86948a',    // muted
    edge: {
        MemberOf: '#ef4444',
        AdminTo: '#ef4444',
        GenericAll: '#ef4444',
        GenericWrite: '#f97316',
        WriteDACL: '#f97316',
        WriteOwner: '#eab308',
        ForceChangePassword: '#ef4444',
        default: '#3c4a42',
    },
}

/* ── Cytoscape stylesheet (hollow outline nodes like reference) ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cyStyles(): any[] {
    return [
        // ── Base node: hollow style ──
        {
            selector: 'node',
            style: {
                'background-color': PAL.bg,        // transparent-look (matches canvas)
                'background-opacity': 0.15,
                width: 44, height: 44,
                label: 'data(displayLabel)',
                'font-size': '11px',
                'font-family': '"Segoe UI", Inter, system-ui, sans-serif',
                'font-weight': '600',
                color: '#94a3b8',
                'text-valign': 'bottom',
                'text-halign': 'center',
                'text-margin-y': 7,
                'text-max-width': '120px',
                'text-wrap': 'ellipsis',
                'text-transform': 'uppercase',
                'text-outline-width': 2,
                'text-outline-color': PAL.bg,
                'text-outline-opacity': 0.9,
                'border-width': 2.5,
                'border-color': PAL.unknown,
                'border-opacity': 0.9,
            },
        },
        // ── User: blue circle (hollow) ──
        {
            selector: 'node[type="User"]',
            style: {
                shape: 'ellipse',
                'border-color': PAL.user,
                'background-color': PAL.user,
                'background-opacity': 0.08,
                color: PAL.user,
            },
        },
        // ── Group: purple square (hollow) ──
        {
            selector: 'node[type="Group"]',
            style: {
                shape: 'round-rectangle',
                'border-color': PAL.group,
                'background-color': PAL.group,
                'background-opacity': 0.08,
                color: PAL.group,
            },
        },
        // ── Computer: cyan diamond (hollow) ──
        {
            selector: 'node[type="Computer"]',
            style: {
                shape: 'diamond',
                'border-color': PAL.computer,
                'background-color': PAL.computer,
                'background-opacity': 0.08,
                color: PAL.computer,
            },
        },
        // ── Domain Controller: amber star ──
        {
            selector: 'node[?isDC]',
            style: {
                shape: 'star',
                width: 60, height: 60,
                'border-color': PAL.dc,
                'border-width': 3,
                'background-color': PAL.dc,
                'background-opacity': 0.25,
                color: PAL.dc,
                'font-weight': 'bold',
                'font-size': '12px',
            },
        },
        // ── High-Value Target: red filled ──
        {
            selector: 'node[?isHvt]',
            style: {
                'border-color': PAL.hvt,
                'border-width': 3,
                'background-color': PAL.hvt,
                'background-opacity': 0.3,
                width: 48, height: 48,
                color: PAL.hvt,
                'font-weight': 'bold',
                'font-size': '11px',
            },
        },
        // ── Admin: orange accent border ──
        {
            selector: 'node[?isAdmin]',
            style: { 'border-color': PAL.admin, 'border-width': 3, color: PAL.admin },
        },
        // ── Selected ──
        {
            selector: ':selected',
            style: {
                'border-width': 3, 'border-color': '#818cf8',
                'background-opacity': 0.3,
                'shadow-blur': 18, 'shadow-color': '#818cf8', 'shadow-opacity': 0.8,
                'shadow-offset-x': 0, 'shadow-offset-y': 0,
                color: '#e2e8f0',
            },
        },
        // ── Highlighted ──
        {
            selector: '.highlighted',
            style: { opacity: 1, 'border-width': 2.5, 'background-opacity': 0.25, color: '#e2e8f0' },
        },
        // ── Dimmed ──
        { selector: '.dimmed', style: { opacity: 0.06 } },
        // ── Search match ──
        {
            selector: '.found',
            style: {
                opacity: 1, 'border-width': 3, 'border-color': '#22c55e',
                'background-opacity': 0.3,
                'shadow-blur': 18, 'shadow-color': '#22c55e', 'shadow-opacity': 1,
                'shadow-offset-x': 0, 'shadow-offset-y': 0,
            },
        },
        // ── Edges ──
        {
            selector: 'edge',
            style: {
                width: 1.5, 'line-color': PAL.edge.default,
                'target-arrow-color': PAL.edge.default,
                'target-arrow-shape': 'triangle', 'arrow-scale': 0.85,
                'curve-style': 'bezier',
                label: 'data(etype)', 'font-size': '8px',
                'font-family': '"JetBrains Mono", monospace',
                color: '#475569', 'text-rotation': 'autorotate',
                'text-background-color': PAL.bg, 'text-background-opacity': 0.85,
                'text-background-padding': '2px',
                opacity: 0.5,
            },
        },
        // Edge colours by type
        ...Object.entries(PAL.edge)
            .filter(([k]) => k !== 'default')
            .map(([type, color]) => ({
                selector: `edge[etype="${type}"]`,
                style: {
                    'line-color': color, 'target-arrow-color': color,
                    width: ['AdminTo', 'GenericAll'].includes(type) ? 2.5 : 1.5,
                    color, opacity: 0.6,
                },
            })),
        { selector: 'edge.dimmed', style: { opacity: 0.03 } },
        { selector: 'edge.highlighted', style: { opacity: 1, width: 2.5 } },
    ]
}

/* ── Detail panel ───────────────────────────────────────────────── */
type NodeInfo = {
    id: string; label: string; type: string
    isDC: boolean; isHvt: boolean; isAdmin: boolean
    degree: number; inbound: number; outbound: number
}

function DetailPanel({ info, onClose }: { info: NodeInfo; onClose: () => void }) {
    const Ic: Record<string, React.ElementType> = { User: User, Group: Users, Computer: Monitor }
    const Icon = Ic[info.type] ?? Shield
    const tc: Record<string, string> = { User: 'text-blue-400', Group: 'text-purple-400', Computer: 'text-cyan-400' }
    return (
        <div className="w-60 flex-shrink-0 card overflow-y-auto flex flex-col gap-3">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <Icon size={16} className={tc[info.type] ?? 'text-ink-muted'} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{info.type}</span>
                </div>
                <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors"><X size={14} /></button>
            </div>
            <p className="font-mono text-sm font-bold text-ink break-all leading-snug">{info.label}</p>
            <div className="flex flex-wrap gap-1.5">
                {info.isDC && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">DC</span>}
                {info.isHvt && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">HVT</span>}
                {info.isAdmin && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">ADMIN</span>}
            </div>
            <div className="sep" />
            <dl className="space-y-2 text-xs">
                {([['Connections', info.degree], ['Inbound', info.inbound], ['Outbound', info.outbound]] as const).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                        <dt className="text-ink-muted">{k}</dt>
                        <dd className="font-mono font-bold text-ink">{v}</dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}

/* ── Main ────────────────────────────────────────────────────────── */
function truncate(s: string, max = 20) { return s.length > max ? s.slice(0, max) + '…' : s }

export default function GraphPage() {
    const { session } = useSession()
    const containerRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cyRef = useRef<any>(null)
    const [layout, setLayout] = useState('cose')
    const [nodeCount, setNodeCount] = useState(0)
    const [edgeCount, setEdgeCount] = useState(0)
    const [search, setSearch] = useState('')
    const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null)
    const [hideOrphans, setHideOrphans] = useState(true)

    useEffect(() => {
        if (!session?.graph?.nodes?.length || !containerRef.current) return
        let cancelled = false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let localCy: any = null

        if (cyRef.current) { try { cyRef.current.destroy() } catch { /* */ } cyRef.current = null }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        try { const el = containerRef.current as any; if (el._private) delete el._private } catch { /* */ }

        const gn = session.graph.nodes as Record<string, unknown>[]
        const ge = (session.graph.edges ?? []) as Record<string, unknown>[]

        import('cytoscape').then(({ default: Cytoscape }) => {
            if (cancelled || !containerRef.current) return
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            try { const el2 = containerRef.current as any; if (el2._private) delete el2._private } catch { /* */ }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const elements: any[] = []
            for (const n of gn) {
                const raw = String(n.label ?? n.sam ?? n.id ?? '')
                const isDC = !!(n.is_domain_controller)
                elements.push({
                    group: 'nodes',
                    data: {
                        id: String(n.id),
                        displayLabel: truncate(raw.replace(/^CN=/i, '')),
                        fullLabel: raw,
                        type: String(n.object_type ?? 'Unknown'),
                        isDC,
                        isHvt: !!(n.is_hvt) && !isDC,
                        isAdmin: !!(n.is_admin),
                    },
                })
            }
            for (let i = 0; i < ge.length; i++) {
                const e = ge[i]
                elements.push({
                    group: 'edges',
                    data: { id: `e${i}`, source: String(e.source), target: String(e.target), etype: String(e.type ?? '') },
                })
            }

            setEdgeCount(ge.length)

            // Track connected node IDs for orphan filtering
            const connectedIds = new Set<string>()
            for (const e of ge) {
                connectedIds.add(String(e.source))
                connectedIds.add(String(e.target))
            }
            const connectedCount = elements.filter((el: any) => el.group === 'nodes' && connectedIds.has(el.data.id)).length
            setNodeCount(connectedCount)

            try {
                localCy = Cytoscape({
                    container: containerRef.current,
                    elements,
                    style: cyStyles(),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    layout: {
                        name: 'cose',
                        padding: 80,
                        nodeRepulsion: () => 1800000,
                        idealEdgeLength: () => 160,
                        edgeElasticity: () => 100,
                        gravity: 0.4,
                        animate: false,
                        randomize: false,
                    } as any,
                    userZoomingEnabled: true,
                    wheelSensitivity: 0.2,
                    minZoom: 0.02,
                    maxZoom: 12,
                    boxSelectionEnabled: false,
                    pixelRatio: 'auto',
                })

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                localCy.on('tap', 'node', (evt: any) => {
                    const node = evt.target
                    const hood = node.closedNeighborhood()
                    localCy.elements().addClass('dimmed').removeClass('highlighted')
                    hood.removeClass('dimmed').addClass('highlighted')
                    node.removeClass('dimmed').select()
                    const d = node.data()
                    setSelectedNode({
                        id: d.id, label: d.fullLabel || d.displayLabel, type: d.type,
                        isDC: !!d.isDC, isHvt: !!d.isHvt, isAdmin: !!d.isAdmin,
                        degree: node.degree(false), inbound: node.indegree(false), outbound: node.outdegree(false),
                    })
                })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                localCy.on('tap', (evt: any) => {
                    if (evt.target === localCy) {
                        localCy.elements().removeClass('dimmed highlighted found').unselect()
                        setSelectedNode(null)
                    }
                })
                localCy.on('mouseover', 'node', () => { if (containerRef.current) containerRef.current.style.cursor = 'pointer' })
                localCy.on('mouseout', 'node', () => { if (containerRef.current) containerRef.current.style.cursor = 'default' })
                cyRef.current = localCy

                // Hide orphan nodes (0 edges) by default
                const orphans = localCy.nodes().filter((n: any) => n.degree(false) === 0)
                orphans.addClass('orphan-hidden')
                orphans.style('display', 'none')
            } catch (err) { console.error('[Graph] init:', err) }
        }).catch(err => console.error('[Graph] import:', err))

        return () => {
            cancelled = true
            if (localCy) { try { localCy.destroy() } catch { /* */ } }
            cyRef.current = null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            try { const el3 = containerRef.current as any; if (el3?._private) delete el3._private } catch { /* */ }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session])

    const handleLayout = useCallback((val: string) => {
        setLayout(val)
        if (!cyRef.current) return
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const opts: any = { name: val, animate: true, animationDuration: 600, fit: true, padding: 60 }
            if (val === 'cose') {
                Object.assign(opts, {
                    nodeRepulsion: () => 1800000, idealEdgeLength: () => 160,
                    edgeElasticity: () => 100, gravity: 0.4, randomize: false,
                    animate: false,
                })
            } else if (val === 'breadthfirst') {
                Object.assign(opts, { spacingFactor: 1.8, directed: true, padding: 60 })
            } else if (val === 'concentric') {
                Object.assign(opts, { spacingFactor: 3.0, minNodeSpacing: 100 })
            } else if (val === 'circle') {
                Object.assign(opts, { spacingFactor: 2.8 })
            }
            cyRef.current.layout(opts).run()
        } catch { /* */ }
    }, [])

    const handleSearch = useCallback((q: string) => {
        setSearch(q)
        if (!cyRef.current || !q.trim()) { cyRef.current?.elements().removeClass('found dimmed'); return }
        const lower = q.toLowerCase()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matched = cyRef.current.nodes().filter((n: any) =>
            (n.data('displayLabel') || '').toLowerCase().includes(lower) ||
            (n.data('fullLabel') || '').toLowerCase().includes(lower)
        )
        if (matched.length === 0) return
        cyRef.current.elements().addClass('dimmed').removeClass('found')
        matched.removeClass('dimmed').addClass('found')
        cyRef.current.animate({ fit: { eles: matched, padding: 120 }, duration: 500, easing: 'ease-in-out-cubic' })
    }, [])

    return (
        <div className="flex flex-col h-[calc(100vh-3rem)]">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-3">
                <div>
                    <h2 className="text-lg font-semibold text-ink">AD Permission Graph</h2>
                    {nodeCount > 0 && <p className="text-xs text-ink-muted">{nodeCount} nodes · {edgeCount} edges</p>}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input value={search} onChange={e => handleSearch(e.target.value)}
                        placeholder="Search node…" className="input pl-8 py-1.5 text-xs w-full" />
                    {search && <button onClick={() => handleSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"><X size={12} /></button>}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <select value={layout} onChange={e => handleLayout(e.target.value)}
                        className="input py-1 text-xs appearance-none w-40">
                        {LAYOUTS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <button onClick={() => {
                        if (!cyRef.current) return
                        const connected = cyRef.current.nodes().filter((n: any) => n.degree(false) > 0)
                        if (connected.length > 0) cyRef.current.animate({ fit: { eles: connected, padding: 60 }, duration: 500 })
                        else cyRef.current.fit(undefined, 60)
                    }} className="btn-ghost py-1 gap-1.5"><Maximize2 size={12} /> Fit</button>
                    <button onClick={() => {
                        try { cyRef.current?.elements().removeClass('dimmed highlighted found').unselect(); setSelectedNode(null); setSearch('') } catch { }
                    }} className="btn-ghost py-1 gap-1.5"><RotateCcw size={12} /> Reset</button>
                    <button onClick={() => {
                        if (!cyRef.current) return
                        const next = !hideOrphans
                        setHideOrphans(next)
                        const orphans = cyRef.current.nodes().filter((n: any) => n.degree(false) === 0)
                        if (next) {
                            orphans.style('display', 'none')
                        } else {
                            orphans.style('display', 'element')
                        }
                    }} className="btn-ghost py-1 gap-1.5">
                        {hideOrphans ? <Eye size={12} /> : <EyeOff size={12} />}
                        {hideOrphans ? 'Show All' : 'Hide Orphans'}
                    </button>
                </div>
            </div>

            {/* Canvas + panels */}
            <div className="flex gap-3 flex-1 min-h-0">
                <div className="flex-1 rounded-lg border border-[#151a2a] overflow-hidden relative"
                    style={{ background: PAL.bg }}>
                    {!session?.graph?.nodes?.length && (
                        <div className="absolute inset-0 flex items-center justify-center text-ink-muted text-sm z-10 pointer-events-none">No graph data</div>
                    )}
                    <div ref={containerRef} className="w-full h-full" />
                </div>

                <aside className="w-52 flex-shrink-0 card overflow-y-auto flex flex-col text-xs">
                    {/* Node details (when selected) */}
                    {selectedNode && (
                        <>
                            <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    {(() => {
                                        const Ic: Record<string, React.ElementType> = { User: User, Group: Users, Computer: Monitor }
                                        const Icon = Ic[selectedNode.type] ?? Shield
                                        const tc: Record<string, string> = { User: 'text-red-400', Group: 'text-amber-400', Computer: 'text-cyan-400' }
                                        return <Icon size={16} className={tc[selectedNode.type] ?? 'text-ink-muted'} />
                                    })()}
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{selectedNode.type}</span>
                                </div>
                                <button onClick={() => {
                                    setSelectedNode(null); cyRef.current?.elements().removeClass('dimmed highlighted').unselect()
                                }} className="text-ink-muted hover:text-ink transition-colors"><X size={14} /></button>
                            </div>
                            <p className="font-mono text-sm font-bold text-ink break-all leading-snug mb-2">{selectedNode.label}</p>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedNode.isDC && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">DC</span>}
                                {selectedNode.isHvt && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">HVT</span>}
                                {selectedNode.isAdmin && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">ADMIN</span>}
                            </div>
                            <dl className="space-y-1.5 mb-3">
                                {([['Connections', selectedNode.degree], ['Inbound', selectedNode.inbound], ['Outbound', selectedNode.outbound]] as const).map(([k, v]) => (
                                    <div key={k} className="flex justify-between">
                                        <dt className="text-ink-muted">{k}</dt>
                                        <dd className="font-mono font-bold text-ink">{v}</dd>
                                    </div>
                                ))}
                            </dl>
                            <div className="sep mb-3" />
                        </>
                    )}

                    {/* Legend (always visible) */}
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Node Types</p>
                    {[
                        { color: PAL.user, label: 'User', sym: '●' },
                        { color: PAL.group, label: 'Group', sym: '■' },
                        { color: PAL.computer, label: 'Computer', sym: '◆' },
                        { color: PAL.hvt, label: 'High‑Value Target', sym: '●' },
                        { color: PAL.dc, label: 'DC', sym: '★' },
                    ].map(({ color, label, sym }) => (
                        <div key={label} className="flex items-center gap-2.5 mb-1.5">
                            <span className="text-sm font-bold w-4 text-center flex-shrink-0" style={{ color }}>{sym}</span>
                            <span className="text-ink-subtle">{label}</span>
                        </div>
                    ))}

                    <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mt-4 mb-2">Edge Types</p>
                    {[
                        { color: PAL.edge.MemberOf, label: 'MemberOf' },
                        { color: PAL.edge.AdminTo, label: 'AdminTo' },
                        { color: PAL.edge.GenericAll, label: 'GenericAll' },
                        { color: PAL.edge.GenericWrite, label: 'GenericWrite' },
                        { color: PAL.edge.WriteDACL, label: 'WriteDACL' },
                        { color: PAL.edge.WriteOwner, label: 'WriteOwner' },
                    ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-2.5 mb-1.5">
                            <span className="w-5 h-[2px] flex-shrink-0 rounded-full inline-block" style={{ background: color }} />
                            <span className="text-ink-muted">{label}</span>
                        </div>
                    ))}

                    {!selectedNode && (
                        <div className="mt-4 pt-3 border-t border-bg-border text-[10px] text-ink-muted/50 leading-relaxed">
                            Click a node to highlight its connections and see details.
                        </div>
                    )}
                </aside>
            </div>
        </div>
    )
}
