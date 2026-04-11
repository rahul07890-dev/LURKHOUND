'use client'
import { useState, useMemo } from 'react'
import { useSession } from '@/context/SessionContext'
import { ChevronRight, ChevronDown, FolderTree, Link2, Shield, FileText, Unlink } from 'lucide-react'
import clsx from 'clsx'

/* ── Tree Node Component ────────────────────────────────────────── */
function OUNode({ ou, depth = 0 }: { ou: OUItem; depth?: number }) {
    const [expanded, setExpanded] = useState(depth < 2)
    const hasChildren = ou.children.length > 0 || ou.linked_gpos.length > 0

    return (
        <div style={{ marginLeft: depth * 16 }}>
            <div
                className={clsx(
                    'flex items-center gap-2 py-2 px-2.5 rounded-md cursor-pointer transition-colors',
                    'hover:bg-bg-raised/60 group'
                )}
                onClick={() => setExpanded(e => !e)}
            >
                {hasChildren ? (
                    expanded ? <ChevronDown size={14} className="text-ink-muted transition-transform" />
                        : <ChevronRight size={14} className="text-ink-muted transition-transform" />
                ) : <span className="w-3.5" />}
                <FolderTree size={14} className="text-yellow-400" />
                <span className="text-sm font-medium text-ink">{ou.name}</span>
                {ou.description && (
                    <span className="text-[10px] text-ink-muted truncate max-w-[180px]">— {ou.description}</span>
                )}
                {ou.linked_gpos.length > 0 && (
                    <span className="text-[10px] font-medium text-accent ml-auto px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        {ou.linked_gpos.length} GPO{ou.linked_gpos.length > 1 ? 's' : ''}
                    </span>
                )}
            </div>
            {expanded && (
                <div className="ml-4 border-l border-bg-border/50 pl-1">
                    {ou.linked_gpos.map((gpo, i) => (
                        <div key={i} className="flex items-center gap-2 py-1.5 px-3 ml-2 rounded-md hover:bg-bg-raised/30 transition-colors">
                            <Link2 size={12} className="text-blue-400 flex-shrink-0" />
                            <span className="text-xs text-ink-subtle">{gpo.name}</span>
                            {gpo.enforced && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                    <Shield size={8} />
                                    ENFORCED
                                </span>
                            )}
                        </div>
                    ))}
                    {ou.children.map((child, i) => (
                        <OUNode key={i} ou={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

type LinkedGPO = { name: string; dn: string; enforced: boolean }
type OUItem = { name: string; dn: string; description: string; linked_gpos: LinkedGPO[]; children: OUItem[] }

/* ── Build Tree ─────────────────────────────────────────────────── */
function buildOUTree(ous: any[], gpos: any[]): OUItem[] {
    // Map GPO DN -> display name
    const gpoDnToName: Record<string, string> = {}
    for (const g of gpos) {
        const dn = (g.dn || '').toUpperCase()
        gpoDnToName[dn] = g.display_name || g.name || dn
    }

    // Build flat items
    const items: OUItem[] = ous.map(ou => ({
        name: ou.name || ou.dn,
        dn: ou.dn,
        description: ou.description || '',
        linked_gpos: (ou.linked_gpos || []).map((lg: any) => ({
            name: gpoDnToName[(lg.dn || '').toUpperCase()] || lg.dn,
            dn: lg.dn,
            enforced: lg.enforced || false,
        })),
        children: [],
    }))

    // Build hierarchy from DNs
    const dnMap = new Map<string, OUItem>()
    for (const item of items) dnMap.set(item.dn.toUpperCase(), item)

    const roots: OUItem[] = []
    for (const item of items) {
        const parts = item.dn.split(',')
        const parentDn = parts.slice(1).join(',').toUpperCase()
        const parent = dnMap.get(parentDn)
        if (parent) {
            parent.children.push(item)
        } else {
            roots.push(item)
        }
    }
    return roots
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function OUTreePage() {
    const { session } = useSession()
    const ous = (session as any)?.ous ?? []
    const gpos = (session as any)?.gpos ?? []

    const tree = useMemo(() => buildOUTree(ous, gpos), [ous, gpos])

    // Find which GPOs are linked vs unlinked
    const linkedGpoDns = useMemo(() => {
        const set = new Set<string>()
        for (const ou of ous) {
            for (const lg of (ou.linked_gpos || [])) {
                set.add((lg.dn || '').toUpperCase())
            }
        }
        return set
    }, [ous])

    const gpoItems = useMemo(() => {
        return gpos.map((g: any) => ({
            name: g.display_name || g.name || g.dn,
            dn: g.dn,
            linked: linkedGpoDns.has((g.dn || '').toUpperCase()),
            linkedTo: ous
                .filter((ou: any) => (ou.linked_gpos || []).some((lg: any) => (lg.dn || '').toUpperCase() === (g.dn || '').toUpperCase()))
                .map((ou: any) => ou.name || ou.dn),
        }))
    }, [gpos, linkedGpoDns, ous])

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-ink">OU Tree</h2>
                <p className="text-sm text-ink-muted">
                    {ous.length} OU{ous.length !== 1 ? 's' : ''} &middot; {gpos.length} GPO{gpos.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* OU Hierarchy */}
            <div className="card">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3 flex items-center gap-2">
                    <FolderTree size={13} className="text-yellow-400" />
                    Organizational Units
                </p>
                {tree.length > 0 ? (
                    tree.map((root, i) => <OUNode key={i} ou={root} />)
                ) : (
                    <div className="flex flex-col items-center py-12 text-ink-muted">
                        <FolderTree size={32} className="mb-2 opacity-40" />
                        <p className="text-sm">No OUs found. Connect to a domain to enumerate Organizational Units.</p>
                    </div>
                )}
            </div>

            {/* All GPOs */}
            {gpoItems.length > 0 && (
                <div className="card">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3 flex items-center gap-2">
                        <FileText size={13} className="text-blue-400" />
                        All Group Policy Objects ({gpoItems.length})
                    </p>
                    <div className="space-y-1">
                        {gpoItems.map((gpo: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-bg-raised/50 transition-colors border-b border-bg-border/20 last:border-0">
                                <FileText size={13} className={gpo.linked ? 'text-blue-400' : 'text-ink-muted/40'} />
                                <span className="text-sm text-ink font-medium flex-1">{gpo.name}</span>
                                {gpo.linked ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                        <Link2 size={9} />
                                        Linked to {gpo.linkedTo.join(', ')}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-muted bg-bg-raised px-2 py-0.5 rounded-full border border-bg-border">
                                        <Unlink size={9} />
                                        Not linked to any OU
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

