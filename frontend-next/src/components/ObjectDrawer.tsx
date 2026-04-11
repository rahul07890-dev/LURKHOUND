'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from '@/context/SessionContext'
import { X, User, Users, Monitor, Shield, Link2 } from 'lucide-react'
import clsx from 'clsx'

type ObjectDrawerProps = {
    objectName: string | null
    onClose: () => void
}

const TYPE_ICONS: Record<string, any> = { User, Group: Users, Computer: Monitor }

export default function ObjectDrawer({ objectName, onClose }: ObjectDrawerProps) {
    const { session } = useSession()
    const drawerRef = useRef<HTMLDivElement>(null)

    // Find the object and related info
    const data = useMemo(() => {
        if (!objectName || !session) return null
        const upper = objectName.toUpperCase()
        const allObjs = [...(session.users || []), ...(session.groups || []), ...(session.computers || [])]
        const obj = allObjs.find(o =>
            o.sam_account_name?.toUpperCase() === upper || o.dn?.toUpperCase().includes(upper)
        )
        if (!obj) return null

        const sam = obj.sam_account_name || ''
        const findings = (session.findings || []).filter(f =>
            (f.affected_objects || []).some((a: string) => a.toUpperCase() === sam.toUpperCase())
        )
        const paths = (session.attack_paths || []).filter(p =>
            (p.path || []).some((n: string) => n.toUpperCase() === sam.toUpperCase())
        )

        return { obj, findings, paths }
    }, [objectName, session])

    if (!objectName || !data) return null

    const { obj, findings, paths } = data
    const Icon = TYPE_ICONS[obj.object_type] || Shield
    const attrs = obj.attributes || {}

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

            {/* Drawer */}
            <div
                ref={drawerRef}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-bg-card border-l border-bg-border z-50 overflow-y-auto shadow-2xl animate-slide-in"
            >
                {/* Header */}
                <div className="sticky top-0 bg-bg-card border-b border-bg-border p-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <Icon size={18} className="text-accent" />
                        <div>
                            <p className="text-sm font-semibold text-ink">{obj.sam_account_name}</p>
                            <p className="text-xs text-ink-muted">{obj.object_type}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-bg-raised rounded transition-colors">
                        <X size={16} className="text-ink-muted" />
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    {/* Basic Info */}
                    <section>
                        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Details</h3>
                        <div className="space-y-1.5">
                            {[
                                ['Display Name', obj.display_name],
                                ['DN', obj.dn],
                                ['Description', obj.description],
                                ['SID', (obj as any).sid],
                            ].filter(([, v]) => v).map(([k, v]) => (
                                <div key={k as string} className="flex gap-2">
                                    <span className="text-xs text-ink-muted w-24 flex-shrink-0">{k}</span>
                                    <span className="text-xs text-ink-subtle font-mono break-all">{v as string}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Attributes */}
                    <section>
                        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Attributes</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(attrs)
                                .filter(([, v]) => typeof v === 'boolean' && v)
                                .map(([k]) => (
                                    <span key={k} className="tag text-[10px]">{k.replace(/^is_/, '').replace(/_/g, ' ')}</span>
                                ))}
                        </div>
                    </section>

                    {/* Group memberships */}
                    {(obj.member_of?.length ?? 0) > 0 && (
                        <section>
                            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
                                Member Of ({obj.member_of!.length})
                            </h3>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {obj.member_of!.map((dn, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <Users size={10} className="text-ink-muted" />
                                        <span className="text-xs text-ink-subtle font-mono truncate">{dn.split(',')[0]?.replace('CN=', '')}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Related findings */}
                    {findings.length > 0 && (
                        <section>
                            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
                                Related Findings ({findings.length})
                            </h3>
                            <div className="space-y-1.5">
                                {findings.map((f: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-bg-raised/50">
                                        <span className={clsx('badge-' + f.severity.toLowerCase(), 'text-[9px]')}>{f.severity}</span>
                                        <span className="text-xs text-ink-subtle truncate">{f.title}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Related attack paths */}
                    {paths.length > 0 && (
                        <section>
                            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
                                Related Attack Paths ({paths.length})
                            </h3>
                            <div className="space-y-1.5">
                                {paths.slice(0, 10).map((p: any, i: number) => (
                                    <div key={i} className="p-2 rounded bg-bg-raised/50">
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className={clsx('badge-' + p.severity.toLowerCase(), 'text-[9px]')}>{p.severity}</span>
                                            <span className="text-ink-subtle truncate">{p.chain}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </>
    )
}
