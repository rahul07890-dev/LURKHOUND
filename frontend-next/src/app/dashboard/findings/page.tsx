'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSession } from '@/context/SessionContext'
import { Finding, FindingStatus, updateFindingStatus, getFindingStatuses, exportFindingsCSV } from '@/lib/api'
import { useToast } from '@/components/Toast'
import {
    ChevronDown, ChevronRight, Copy, Check, Filter,
    AlertTriangle, ShieldAlert, Terminal, Lightbulb, Wrench, CircleDot, FileSpreadsheet
} from 'lucide-react'
import clsx from 'clsx'

/* ── Severity badge ──────────────────────────────────────────────── */
function SevBadge({ sev }: { sev: string }) {
    const cls: Record<string, string> = {
        Critical: 'badge-critical', High: 'badge-high',
        Medium: 'badge-medium', Low: 'badge-low',
    }
    return <span className={cls[sev] ?? 'badge-low'}>{sev}</span>
}

/* ── Copy button ─────────────────────────────────────────────────── */
function CopyButton({ code }: { code: string }) {
    const [copied, setCopied] = useState(false)
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors"
        >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    )
}

/* ── Status colors ───────────────────────────────────────────────── */
const STATUS_META: Record<FindingStatus, { label: string; color: string }> = {
    open: { label: 'Open', color: 'text-red-400' },
    acknowledged: { label: 'Acknowledged', color: 'text-yellow-400' },
    in_progress: { label: 'In Progress', color: 'text-blue-400' },
    fixed: { label: 'Fixed', color: 'text-green-400' },
    accepted_risk: { label: 'Accepted Risk', color: 'text-purple-400' },
}

/* ── Finding card ────────────────────────────────────────────────── */
function FindingCard({ finding, status, onStatusChange }: {
    finding: Finding; status: FindingStatus;
    onStatusChange: (id: string, status: FindingStatus) => void
}) {
    const [open, setOpen] = useState(false)

    // Parse numbered remediation steps from the flat string
    const remediationSteps = useMemo(() => {
        if (!finding.remediation) return []
        return finding.remediation
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
    }, [finding.remediation])

    const hasRemediation = !!(finding.remediation || finding.powershell_fix || finding.explanation)

    return (
        <div className={clsx(
            'card cursor-pointer transition-all duration-200',
            open ? 'border-bg-border/80 ring-1 ring-accent/10' : 'hover:border-bg-border/80'
        )}>
            {/* Header */}
            <div className="flex items-start gap-3" onClick={() => setOpen(o => !o)}>
                <SevBadge sev={finding.severity} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{finding.title}</p>
                    {!open && (
                        <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">{finding.description}</p>
                    )}
                </div>
                {/* Status dropdown */}
                <select
                    value={status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { e.stopPropagation(); onStatusChange(finding.id, e.target.value as FindingStatus) }}
                    className={clsx('input text-xs py-0.5 px-2 w-32 flex-shrink-0', STATUS_META[status]?.color)}
                >
                    {Object.entries(STATUS_META).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                {open ? <ChevronDown size={14} className="text-ink-muted mt-0.5 flex-shrink-0" />
                    : <ChevronRight size={14} className="text-ink-muted mt-0.5 flex-shrink-0" />}
            </div>

            {/* Expanded content */}
            {open && (
                <div className="mt-4 space-y-5 border-t border-bg-border pt-4">
                    {/* Explanation (from remediation.py) */}
                    {finding.explanation && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Lightbulb size={12} className="text-yellow-400" />
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">What This Means</p>
                            </div>
                            <p className="text-sm text-ink-subtle leading-relaxed pl-5">{finding.explanation}</p>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <AlertTriangle size={12} className="text-orange-400" />
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Description</p>
                        </div>
                        <p className="text-sm text-ink-subtle leading-relaxed pl-5">{finding.description}</p>
                    </div>

                    {/* Impact */}
                    {finding.impact && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <ShieldAlert size={12} className="text-red-400" />
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Impact</p>
                            </div>
                            <p className="text-sm text-ink-subtle leading-relaxed pl-5">{finding.impact}</p>
                        </div>
                    )}

                    {/* Affected objects */}
                    {finding.affected_objects?.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2 pl-5">
                                Affected Objects
                            </p>
                            <div className="flex flex-wrap gap-1.5 pl-5">
                                {finding.affected_objects.map(o => (
                                    <span key={o} className="tag font-mono text-[10px]">{o}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* MITRE */}
                    {finding.mitre_techniques?.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2 pl-5">
                                MITRE ATT&amp;CK
                            </p>
                            <div className="flex flex-wrap gap-1.5 pl-5">
                                {finding.mitre_techniques.map(t => (
                                    <a key={t.id} href={t.url} target="_blank" rel="noreferrer"
                                        className="badge-mitre hover:opacity-80 transition-opacity">
                                        {t.id} — {t.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Remediation Section ──────────────────────────────── */}
                    {hasRemediation && (
                        <div className="rounded-lg bg-green-500/5 border border-green-500/15 p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <Wrench size={14} className="text-green-400" />
                                <p className="text-sm font-semibold text-green-400">Remediation Guide</p>
                            </div>

                            {/* Steps */}
                            {remediationSteps.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Fix Steps</p>
                                    <ol className="space-y-1.5">
                                        {remediationSteps.map((s, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-ink-subtle">
                                                <span className="text-green-500/70 flex-shrink-0 font-mono text-xs mt-0.5">
                                                    {String(i + 1).padStart(2, '0')}.
                                                </span>
                                                <span>{s.replace(/^\d+\.\s*/, '')}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* Risk reduction */}
                            {finding.risk_reduction && (
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                                        Risk Reduction
                                    </p>
                                    <p className="text-sm text-ink-subtle leading-relaxed">{finding.risk_reduction}</p>
                                </div>
                            )}

                            {/* PowerShell */}
                            {finding.powershell_fix && (
                                <div>
                                    <div className="rounded-md bg-bg-base border border-bg-border overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-bg-border bg-bg-raised">
                                            <div className="flex items-center gap-1.5">
                                                <Terminal size={11} className="text-blue-400" />
                                                <span className="text-[10px] font-mono font-semibold text-ink-muted">PowerShell</span>
                                            </div>
                                            <CopyButton code={finding.powershell_fix} />
                                        </div>
                                        <pre className="p-3 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                            {finding.powershell_fix}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/* ── Main page ───────────────────────────────────────────────────── */
const SEVERITIES = ['ALL', 'Critical', 'High', 'Medium', 'Low']
const STATUS_FILTERS = ['ALL', 'open', 'acknowledged', 'in_progress', 'fixed', 'accepted_risk']

export default function FindingsPage() {
    const { session } = useSession()
    const [sevFilter, setSevFilter] = useState('ALL')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [statuses, setStatuses] = useState<Record<string, FindingStatus>>({})

    // Load initial statuses
    useEffect(() => {
        if (session) {
            getFindingStatuses().then(setStatuses).catch(() => {})
        }
    }, [session])

    const { addToast } = useToast()

    const handleStatusChange = useCallback(async (findingId: string, status: FindingStatus) => {
        setStatuses(prev => ({ ...prev, [findingId]: status }))
        try {
            await updateFindingStatus(findingId, status)
            addToast('success', `Finding status updated to ${status.replace('_', ' ')}`)
        } catch {
            addToast('error', 'Failed to update finding status')
        }
    }, [addToast])

    const findings = useMemo(
        () => (session?.findings ?? [])
            .filter(f => sevFilter === 'ALL' || f.severity === sevFilter)
            .filter(f => statusFilter === 'ALL' || (statuses[f.id] || 'open') === statusFilter),
        [session, sevFilter, statusFilter, statuses]
    )

    const counts = useMemo(() => {
        const all = session?.findings ?? []
        return {
            Critical: all.filter(f => f.severity === 'Critical').length,
            High: all.filter(f => f.severity === 'High').length,
            Medium: all.filter(f => f.severity === 'Medium').length,
            Low: all.filter(f => f.severity === 'Low').length,
        }
    }, [session])

    // Progress calculation
    const total = session?.findings?.length ?? 0
    const fixedCount = Object.values(statuses).filter(s => s === 'fixed' || s === 'accepted_risk').length
    const pct = total > 0 ? Math.round((fixedCount / total) * 100) : 0

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-ink">Findings</h2>
                    <p className="text-sm text-ink-muted">{total} total issues detected</p>
                </div>
                <div className="flex gap-2">
                    {(['Critical', 'High', 'Medium', 'Low'] as const).map(s => (
                        counts[s] > 0 && (
                            <span key={s} className={`badge-${s.toLowerCase()}`}>
                                {counts[s]} {s}
                            </span>
                        )
                    ))}
                    <button
                        onClick={() => { exportFindingsCSV(session?.findings ?? [], statuses); addToast('success', 'CSV file downloaded') }}
                        className="btn-ghost text-xs gap-1.5 ml-2">
                        <FileSpreadsheet size={12} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Remediation progress bar */}
            <div className="card">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <CircleDot size={14} className="text-green-400" />
                        <span className="text-sm font-medium text-ink">Remediation Progress</span>
                    </div>
                    <span className="text-sm text-ink-muted">{fixedCount}/{total} resolved ({pct}%)</span>
                </div>
                <div className="w-full h-2 bg-bg-base rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #22c55e)' }}
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <div className="relative">
                    <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                        className="input pl-7 py-1.5 text-sm w-44 appearance-none">
                        {SEVERITIES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Severities' : s}</option>)}
                    </select>
                </div>
                <div className="relative">
                    <CircleDot size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="input pl-7 py-1.5 text-sm w-44 appearance-none">
                        {STATUS_FILTERS.map(s => (
                            <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : STATUS_META[s as FindingStatus]?.label || s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Cards */}
            <div className="space-y-3">
                {findings.map((f, i) => (
                    <FindingCard key={i} finding={f}
                        status={statuses[f.id] || 'open'}
                        onStatusChange={handleStatusChange} />
                ))}
                {findings.length === 0 && (
                    <div className="card flex flex-col items-center py-16 text-ink-muted">
                        <p className="text-sm">No findings match the current filter</p>
                    </div>
                )}
            </div>
        </div>
    )
}
