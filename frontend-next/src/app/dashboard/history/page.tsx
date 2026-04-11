'use client'
import { useState, useEffect, useMemo } from 'react'
import { getScans, diffScans, ScanHistoryEntry } from '@/lib/api'
import { Clock, ArrowUpRight, ArrowDownRight, Minus, GitCompare, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

function RiskPill({ score }: { score: number }) {
    const color = score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 25 ? '#eab308' : '#22c55e'
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono"
            style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}>
            {score}
        </span>
    )
}

function DeltaBadge({ value, label }: { value: number; label: string }) {
    if (value === 0) return (
        <div className="flex items-center gap-1 text-ink-muted text-xs">
            <Minus size={10} /> {label}: 0
        </div>
    )
    const positive = value > 0
    return (
        <div className={clsx('flex items-center gap-1 text-xs font-mono', positive ? 'text-red-400' : 'text-green-400')}>
            {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {label}: {positive ? `+${value}` : value}
        </div>
    )
}

type DiffResult = {
    risk_delta: number
    new_findings: number
    resolved_findings: number
    new_paths: number
    removed_paths: number
}

export default function HistoryPage() {
    const [scans, setScans] = useState<ScanHistoryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [compare, setCompare] = useState<[number, number] | null>(null)
    const [diff, setDiff] = useState<DiffResult | null>(null)
    const [diffLoading, setDiffLoading] = useState(false)

    useEffect(() => {
        setLoading(true)
        getScans(50).then(setScans).catch(() => {}).finally(() => setLoading(false))
    }, [])

    const handleCompare = async (id1: number, id2: number) => {
        setCompare([id1, id2])
        setDiffLoading(true)
        try {
            const result = await diffScans(id1, id2) as any
            setDiff({
                risk_delta: (result.new_risk_score ?? 0) - (result.old_risk_score ?? 0),
                new_findings: result.new_findings?.length ?? 0,
                resolved_findings: result.resolved_findings?.length ?? 0,
                new_paths: result.new_paths?.length ?? 0,
                removed_paths: result.removed_paths?.length ?? 0,
            })
        } catch {
            setDiff(null)
        } finally {
            setDiffLoading(false)
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-ink">Scan History</h2>
                    <p className="text-sm text-ink-muted">{scans.length} scans recorded</p>
                </div>
                <button onClick={() => getScans(50).then(setScans)} className="btn-ghost text-xs gap-1.5">
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            {/* Diff Panel */}
            {diff && compare && (
                <div className="card border-accent/30 animate-slideUp">
                    <div className="flex items-center gap-2 mb-4">
                        <GitCompare size={14} className="text-accent" />
                        <p className="module-label">SCAN_DIFF // #{compare[0]} vs #{compare[1]}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="p-3 rounded-lg bg-bg-raised border border-bg-border text-center">
                            <p className="text-[10px] uppercase text-ink-muted mb-1">Risk Delta</p>
                            <p className={clsx('text-2xl font-bold font-mono',
                                diff.risk_delta > 0 ? 'text-red-400' : diff.risk_delta < 0 ? 'text-green-400' : 'text-ink-muted')}>
                                {diff.risk_delta > 0 ? '+' : ''}{diff.risk_delta}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-bg-raised border border-bg-border text-center">
                            <p className="text-[10px] uppercase text-ink-muted mb-1">New Findings</p>
                            <p className="text-2xl font-bold font-mono text-red-400">+{diff.new_findings}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-bg-raised border border-bg-border text-center">
                            <p className="text-[10px] uppercase text-ink-muted mb-1">Resolved</p>
                            <p className="text-2xl font-bold font-mono text-green-400">-{diff.resolved_findings}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-bg-raised border border-bg-border text-center">
                            <p className="text-[10px] uppercase text-ink-muted mb-1">New Paths</p>
                            <p className="text-2xl font-bold font-mono text-orange-400">+{diff.new_paths}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-bg-raised border border-bg-border text-center">
                            <p className="text-[10px] uppercase text-ink-muted mb-1">Removed Paths</p>
                            <p className="text-2xl font-bold font-mono text-green-400">-{diff.removed_paths}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline */}
            {loading ? (
                <div className="card flex items-center justify-center py-16 text-ink-muted text-sm">Loading scan history...</div>
            ) : scans.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-ink-muted">
                    <Clock size={24} className="opacity-30 mb-3" />
                    <p className="text-sm">No scans recorded yet</p>
                    <p className="text-xs mt-1">Run a discovery scan to see your history</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {scans.map((scan, i) => (
                        <div key={scan.id} className="card flex items-center gap-4 group">
                            {/* Timeline dot */}
                            <div className="flex flex-col items-center flex-shrink-0 gap-1">
                                <div className="w-3 h-3 rounded-full border-2"
                                    style={{
                                        borderColor: scan.risk_score >= 70 ? '#ef4444' : scan.risk_score >= 40 ? '#f97316' : '#22c55e',
                                        background: i === 0 ? (scan.risk_score >= 70 ? '#ef4444' : scan.risk_score >= 40 ? '#f97316' : '#22c55e') : 'transparent',
                                    }} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-semibold text-ink">{scan.domain}</span>
                                    <span className="text-[10px] text-ink-muted">{scan.dc_ip}</span>
                                    {i === 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent/15 text-accent border border-accent/30">LATEST</span>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-ink-muted">
                                    <span>{new Date(scan.timestamp).toLocaleString()}</span>
                                    <span>{scan.findings_count} findings</span>
                                    <span>{scan.paths_count} paths</span>
                                </div>
                            </div>

                            {/* Risk */}
                            <RiskPill score={scan.risk_score} />

                            {/* Compare button */}
                            {i < scans.length - 1 && (
                                <button
                                    onClick={() => handleCompare(scan.id, scans[i + 1].id)}
                                    className="btn-ghost text-[10px] py-1 px-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={`Compare with scan #${scans[i + 1].id}`}>
                                    <GitCompare size={10} /> vs #{scans[i + 1].id}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
