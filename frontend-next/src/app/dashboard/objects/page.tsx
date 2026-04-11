'use client'
import { useState, useMemo } from 'react'
import { useSession } from '@/context/SessionContext'
import { ADObject } from '@/lib/api'
import { Search, Shield, Monitor, Layers, Server, Key, Power } from 'lucide-react'
import clsx from 'clsx'

type Tab = 'users' | 'groups' | 'computers'

function Tag({ children, color = 'text-ink-muted', variant }: { children: React.ReactNode; color?: string; variant?: 'admin' | 'dc' | 'disabled' | 'spn' }) {
    const styles: Record<string, React.CSSProperties> = {
        admin: { background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(185,28,28,0.12))', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.35)', boxShadow: 'inset 0 0 6px rgba(239,68,68,0.08)' },
        dc: { background: 'linear-gradient(135deg, rgba(234,179,8,0.18), rgba(161,98,7,0.12))', color: '#fde047', border: '1px solid rgba(234,179,8,0.35)', boxShadow: 'inset 0 0 6px rgba(234,179,8,0.06)' },
        disabled: { background: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.25)' },
        spn: { background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(126,34,206,0.12))', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.35)', boxShadow: 'inset 0 0 6px rgba(168,85,247,0.08)' },
    }
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold"
            style={variant ? styles[variant] : undefined}
        >{children}</span>
    )
}

function ObjectRow({
    obj, isSelected, onClick
}: { obj: ADObject; isSelected: boolean; onClick: () => void }) {
    const isAdmin = obj.attributes?.is_admin as boolean
    const isDC = obj.attributes?.is_domain_controller as boolean
    const isDisabled = obj.attributes?.is_disabled as boolean
    const hasSPN = obj.attributes?.has_spn as boolean

    return (
        <tr
            className={clsx('cursor-pointer transition-colors duration-150', isSelected && 'bg-accent-muted')}
            onClick={onClick}
            style={{ ...(isSelected ? {} : {}), }}
            onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = 'rgba(239,68,68,0.04)') }}
            onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = '') }}
        >
            <td>
                <span className="font-mono text-sm font-medium text-ink">{obj.sam_account_name}</span>
            </td>
            <td>
                <div className="flex gap-1 flex-wrap">
                    {isAdmin && <Tag variant="admin">ADMIN</Tag>}
                    {isDC && <Tag variant="dc">DC</Tag>}
                    {isDisabled && <Tag variant="disabled">DISABLED</Tag>}
                    {hasSPN && <Tag variant="spn">SPN</Tag>}
                </div>
            </td>
            <td className="text-ink-muted text-xs truncate max-w-[200px]">
                {obj.description ?? '—'}
            </td>
        </tr>
    )
}

function DetailPanel({ obj }: { obj: ADObject }) {
    const IconMap: Record<string, React.ElementType> = {
        User: Shield, Group: Layers, Computer: Monitor,
    }
    const Icon = IconMap[obj.object_type] ?? Server

    const boolAttr = (k: string) => (obj.attributes?.[k] ? 'Yes' : 'No')
    const strAttr = (k: string) => String(obj.attributes?.[k] ?? '—')

    const rows =
        obj.object_type === 'User' ? [
            ['SAM', obj.sam_account_name],
            ['Display Name', obj.display_name ?? '—'],
            ['Admin', boolAttr('is_admin')],
            ['Password Never Expires', boolAttr('is_password_never_expires')],
            ['Disabled', boolAttr('is_disabled')],
            ['Has SPN', boolAttr('has_spn')],
        ] : obj.object_type === 'Computer' ? [
            ['SAM', obj.sam_account_name],
            ['DNS Name', strAttr('dNSHostName')],
            ['OS', strAttr('operatingSystem')],
            ['Domain Controller', boolAttr('is_domain_controller')],
            ['Trusted for Delegation', boolAttr('is_trusted_for_delegation')],
        ] : [
            ['SAM', obj.sam_account_name],
            ['Members', String((obj.members ?? []).length)],
        ]

    const memberOf = obj.member_of ?? []
    const members = obj.members ?? []
    const spns = obj.attributes?.spn_list as string[] | undefined

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-bg-border">
                <div className="w-9 h-9 rounded-md bg-bg-raised flex items-center justify-center">
                    <Icon size={16} className="text-ink-subtle" />
                </div>
                <div>
                    <p className="font-semibold text-ink font-mono">{obj.sam_account_name}</p>
                    <p className="text-xs text-ink-muted">{obj.object_type}</p>
                </div>
            </div>

            {/* Attributes */}
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Attributes</p>
                <dl className="space-y-1.5">
                    {rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 text-sm">
                            <dt className="text-ink-muted flex-shrink-0">{k}</dt>
                            <dd className="font-mono text-xs text-ink text-right truncate">{v}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            {/* DN */}
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1">Distinguished Name</p>
                <p className="text-xs font-mono text-ink-subtle break-all">{obj.dn}</p>
            </div>

            {/* SPNs */}
            {spns && spns.length > 0 && (
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Service Principal Names</p>
                    <div className="space-y-1">
                        {spns.map(s => (
                            <div key={s} className="flex items-center gap-1.5">
                                <Key size={11} className="text-purple-400 flex-shrink-0" />
                                <span className="text-xs font-mono text-purple-300">{s}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Member of */}
            {memberOf.length > 0 && (
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Member Of</p>
                    <div className="flex flex-wrap gap-1">
                        {memberOf.map(g => (
                            <span key={g} className="tag text-[10px]">
                                {g.split(',')[0]?.replace('CN=', '') ?? g}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Members */}
            {members.length > 0 && (
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
                        Members ({members.length})
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {members.map(m => (
                            <p key={m} className="text-xs font-mono text-ink-subtle truncate">
                                {m.split(',')[0]?.replace('CN=', '') ?? m}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function ObjectsPage() {
    const { session } = useSession()
    const [tab, setTab] = useState<Tab>('users')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<ADObject | null>(null)

    const objects: Record<Tab, ADObject[]> = {
        users: session?.users ?? [],
        groups: session?.groups ?? [],
        computers: session?.computers ?? [],
    }

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        return objects[tab].filter(o =>
            o.sam_account_name.toLowerCase().includes(q) ||
            (o.display_name ?? '').toLowerCase().includes(q) ||
            (o.description ?? '').toLowerCase().includes(q)
        )
    }, [objects, tab, search])

    const TABS: { id: Tab; label: string; count: number }[] = [
        { id: 'users', label: 'Users', count: objects.users.length },
        { id: 'groups', label: 'Groups', count: objects.groups.length },
        { id: 'computers', label: 'Computers', count: objects.computers.length },
    ]

    return (
        <div className="flex gap-5 h-[calc(100vh-3rem)]">
            {/* Left: list */}
            <div className="flex flex-col flex-1 min-w-0">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-ink">Object Explorer</h2>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-3">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setTab(t.id); setSelected(null) }}
                            className={clsx(
                                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                                tab === t.id
                                    ? 'bg-accent-muted text-accent border border-accent-border'
                                    : 'text-ink-muted hover:text-ink hover:bg-bg-raised'
                            )}
                        >
                            {t.label}
                            <span className="ml-1.5 text-xs opacity-60">({t.count})</span>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input
                        className="input pl-9"
                        placeholder="Filter by name or description..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Table */}
                <div className="card flex-1 overflow-auto p-0">
                    <table className="tbl">
                        <thead className="sticky top-0 bg-bg-card">
                            <tr>
                                <th>Name</th>
                                <th>Tags</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(obj => (
                                <ObjectRow
                                    key={obj.dn}
                                    obj={obj}
                                    isSelected={selected?.dn === obj.dn}
                                    onClick={() => setSelected(obj)}
                                />
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center text-ink-muted py-8">
                                        No objects match filter
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right: detail drawer */}
            <aside className="w-72 flex-shrink-0">
                <div className="card h-full overflow-y-auto" style={{ borderLeft: '2px solid rgba(239,68,68,0.3)', boxShadow: 'inset 2px 0 12px rgba(239,68,68,0.04)' }}>
                    {selected ? (
                        <DetailPanel obj={selected} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-ink-muted text-sm gap-2">
                            <Monitor size={24} className="opacity-30" />
                            <p>Select an object</p>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    )
}
