'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import { useSession } from '@/context/SessionContext'
import { Users, MonitorDot, Shield, GitFork, AlertTriangle, Layers, TrendingUp, Grid3x3, FileDown, FileText } from 'lucide-react'
import { getScans, downloadReport, downloadPDFReport, ScanHistoryEntry } from '@/lib/api'
import { SkeletonStatCard, SkeletonGauge, SkeletonRow } from '@/components/SkeletonLoader'
import { useToast } from '@/components/Toast'
import clsx from 'clsx'

/* ─── Animated Counter Hook ─── */
function useAnimatedCounter(target: number, duration = 1500) {
    const [value, setValue] = useState(0)
    const ref = useRef<number>(0)
    useEffect(() => {
        const start = ref.current
        const diff = target - start
        if (diff === 0) return
        const startTime = performance.now()
        const animate = (now: number) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            const current = Math.round(start + diff * eased)
            setValue(current)
            ref.current = current
            if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
    }, [target, duration])
    return value
}

/* ─── Risk Gauge (Radar-scope style) ─── */
function RiskGauge({ score, level }: { score: number; level: string }) {
    const animatedScore = useAnimatedCounter(score, 1500)
    const colors: Record<string, string> = {
        Critical: '#ef4444',
        High: '#f97316',
        Medium: '#eab308',
        Low: '#22c55e',
    }
    const color = colors[level] ?? '#ef4444'
    const circumference = 2 * Math.PI * 54
    const offset = circumference - (score / 100) * circumference

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative w-40 h-40">
                {/* Concentric tactical rings */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    {/* Outer ring lines */}
                    <circle cx="60" cy="60" r="58" fill="none" stroke="rgba(239,68,68,0.06)" strokeWidth="0.5" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(239,68,68,0.04)" strokeWidth="0.5" strokeDasharray="2 4" />
                    {/* Track */}
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#1a1c20" strokeWidth="8" />
                    {/* Value arc */}
                    <circle
                        cx="60" cy="60" r="54" fill="none"
                        stroke={color} strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{
                            transition: 'stroke-dashoffset 1s ease',
                            filter: `drop-shadow(0 0 6px ${color}80)`,
                        }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono text-ink-muted uppercase tracking-tactical mb-1">RISK_SCORE</span>
                    <span className="text-4xl font-bold font-mono animate-countUp" style={{ color }}>{animatedScore}</span>
                    <span
                        className="text-[10px] font-bold uppercase tracking-tactical mt-1 px-2 py-0.5 rounded-sm"
                        style={{
                            color,
                            background: `${color}18`,
                            border: `1px solid ${color}30`,
                        }}
                    >
                        {level}
                    </span>
                </div>
            </div>
            <div className="flex gap-4 text-[10px] font-mono text-ink-muted">
                <span><span className="text-green-400">■</span> LOW 0–30</span>
                <span><span className="text-amber-400">■</span> MED 31–60</span>
                <span><span className="text-red-400">■</span> HIGH 61–100</span>
            </div>
        </div>
    )
}

function SevBadge({ sev }: { sev: string }) {
    const cls: Record<string, string> = {
        Critical: 'badge-critical',
        High: 'badge-high',
        Medium: 'badge-medium',
        Low: 'badge-low',
    }
    return <span className={cls[sev] ?? 'badge-low'}>{sev}</span>
}

const STAT_DEFS = [
    { key: 'total_users', label: 'Users', icon: Users, clr: '#ef4444' },
    { key: 'total_groups', label: 'Groups', icon: Layers, clr: '#f97316' },
    { key: 'total_computers', label: 'Computers', icon: MonitorDot, clr: '#ffb95f' },
    { key: 'privileged_accounts', label: 'Privileged', icon: Shield, clr: '#ef4444' },
    { key: 'attack_paths_found', label: 'Attack Paths', icon: GitFork, clr: '#f97316' },
    { key: 'findings_count', label: 'Findings', icon: AlertTriangle, clr: '#ffb95f' },
]

export default function OverviewPage() {
    const { session } = useSession()
    const [scans, setScans] = useState<ScanHistoryEntry[]>([])
    const { addToast } = useToast()

    useEffect(() => { getScans(10).then(setScans).catch(() => {}) }, [])

    if (!session) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 xl:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="module"><SkeletonGauge /></div>
                    <div className="module p-4 space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
                    </div>
                </div>
            </div>
        )
    }
    const { summary, findings, attack_paths } = session

    const topFindings = findings.slice(0, 5)

    // Heatmap data
    const heatmapData = useMemo(() => {
        const types = new Map<string, Record<string, number>>()
        for (const p of attack_paths) {
            const t = p.path_type || 'other'
            if (!types.has(t)) types.set(t, { Critical: 0, High: 0, Medium: 0, Low: 0 })
            types.get(t)![p.severity] = (types.get(t)![p.severity] || 0) + 1
        }
        return Array.from(types.entries()).map(([type, counts]) => ({ type, ...counts }))
    }, [attack_paths])

    return (
        <div className="space-y-4">
            {/* ── Stat Strip ── */}
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-3">
                {STAT_DEFS.map(({ key, label, icon: Icon, clr }) => (
                    <div key={key} className="module module-corners">
                        <Icon size={14} style={{ color: clr }} className="mb-1.5" />
                        <div className="text-3xl font-bold font-mono" style={{ color: clr }}>
                            {(summary as Record<string, unknown>)[key] as number}
                        </div>
                        <div className="stat-label">{label}</div>
                    </div>
                ))}
            </div>

            {/* ── Risk Gauge + Domain Admins ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Risk gauge */}
                <div className="module module-corners flex flex-col items-center gap-4 py-6">
                    <RiskGauge score={summary.risk_score} level={summary.risk_level} />
                </div>

                {/* Domain admins */}
                <div className="module module-corners">
                    <p className="module-label mb-4">DOMAIN_ADMINS // HIGH_VALUE_TARGETS</p>
                    {summary.domain_admins?.length ? (
                        <ul className="space-y-2">
                            {summary.domain_admins.map((da: string) => (
                                <li key={da} className="flex items-center justify-between py-2 border-b border-bg-border/50 last:border-0">
                                    <div className="flex items-center gap-2.5">
                                        <Shield size={12} className="text-red-400 flex-shrink-0" />
                                        <span className="font-mono text-sm text-accent">{da}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-ink-muted uppercase">ACTIVE</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-ink-muted">No domain admins found</p>
                    )}
                </div>
            </div>

            {/* ── Active Threat Log ── */}
            {topFindings.length > 0 && (
                <div className="module module-corners">
                    <div className="flex items-center justify-between mb-3">
                        <p className="module-label">ACTIVE_THREAT_LOG // REALTIME</p>
                        <span className="text-[10px] font-mono text-ink-muted">UPDATED_FREQ: 300MS</span>
                    </div>
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th style={{ width: 80 }}>SEV</th>
                                <th>FINDING</th>
                                <th>AFFECTED_OBJECTS</th>
                                <th style={{ width: 100 }}>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topFindings.map((f, i) => (
                                <tr key={i}>
                                    <td><SevBadge sev={f.severity} /></td>
                                    <td className="text-sm text-ink">{f.title}</td>
                                    <td className="text-sm font-mono text-accent">
                                        {f.affected_objects?.length
                                            ? f.affected_objects.slice(0, 2).join(', ')
                                            : '—'}
                                    </td>
                                    <td className="text-[10px] font-mono text-ink-muted uppercase">
                                        {(f as any).status || 'OPEN'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Risk Trend + Heatmap Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Risk Trend Chart */}
                {scans.length > 1 && (() => {
                    const sorted = [...scans].reverse()
                    const maxScore = Math.max(...sorted.map(s => s.risk_score), 100)
                    const chartW = 600, chartH = 180
                    const padL = 36, padR = 16, padT = 24, padB = 32
                    const plotW = chartW - padL - padR
                    const plotH = chartH - padT - padB
                    const pts = sorted.map((s, i) => ({
                        x: padL + (sorted.length > 1 ? (i / (sorted.length - 1)) * plotW : plotW / 2),
                        y: padT + plotH - (s.risk_score / maxScore) * plotH,
                        score: s.risk_score,
                        date: new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                        color: s.risk_score >= 75 ? '#ef4444' : s.risk_score >= 50 ? '#f97316' : s.risk_score >= 25 ? '#eab308' : '#22c55e',
                    }))
                    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
                    const areaPath = `${linePath} L${pts[pts.length - 1].x},${padT + plotH} L${pts[0].x},${padT + plotH} Z`
                    const gridLines = [0, 25, 50, 75, 100].filter(v => v <= maxScore)

                    return (
                        <div className="module module-corners">
                            <div className="flex items-center gap-2.5 mb-4">
                                <TrendingUp size={14} className="text-accent" />
                                <p className="module-label">RISK_TREND // LAST {scans.length} SCANS</p>
                            </div>
                            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
                                <defs>
                                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.08" />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {gridLines.map(v => {
                                    const y = padT + plotH - (v / maxScore) * plotH
                                    return (
                                        <g key={v}>
                                            <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#3c4a42" strokeWidth="0.5" strokeDasharray="4 4" />
                                            <text x={padL - 6} y={y + 3} textAnchor="end" fill="#86948a" fontSize="9" fontFamily="Space Mono">{v}</text>
                                        </g>
                                    )
                                })}
                                <path d={areaPath} fill="url(#trendGrad)" />
                                <path d={linePath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                {pts.map((p, i) => (
                                    <g key={i}>
                                        <circle cx={p.x} cy={p.y} r="4" fill="#0c0e12" stroke={p.color} strokeWidth="2" />
                                        <text x={p.x} y={p.y - 10} textAnchor="middle" fill={p.color} fontSize="9" fontWeight="700" fontFamily="Space Mono">{p.score}</text>
                                        <text x={p.x} y={padT + plotH + 16} textAnchor="middle" fill="#86948a" fontSize="9" fontFamily="Space Mono">{p.date}</text>
                                    </g>
                                ))}
                            </svg>
                        </div>
                    )
                })()}

                {/* Attack Path Heatmap */}
                {heatmapData.length > 0 && (() => {
                    const sevs = ['Critical', 'High', 'Medium', 'Low'] as const
                    const sevColors: Record<string, { bg: string; text: string; glow: string }> = {
                        Critical: { bg: 'rgba(239,68,68,', text: '#fca5a5', glow: '#ef4444' },
                        High: { bg: 'rgba(249,115,22,', text: '#fdba74', glow: '#f97316' },
                        Medium: { bg: 'rgba(234,179,8,', text: '#fde047', glow: '#eab308' },
                        Low: { bg: 'rgba(34,197,94,', text: '#86efac', glow: '#22c55e' },
                    }
                    const globalMax = Math.max(1, ...heatmapData.flatMap(r => sevs.map(s => (r as any)[s] || 0)))
                    const formatType = (t: string) => t.replace(/_/g, ' ').toUpperCase()

                    return (
                        <div className="module module-corners">
                            <div className="flex items-center gap-2.5 mb-4">
                                <Grid3x3 size={14} className="text-accent" />
                                <p className="module-label">PATH_HEATMAP</p>
                            </div>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr>
                                        <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-ink-muted uppercase tracking-tactical">TYPE</th>
                                        {sevs.map(s => (
                                            <th key={s} className="text-center py-1.5 px-1 text-[10px] font-semibold uppercase tracking-tactical" style={{ color: sevColors[s].text }}>{s.slice(0, 4)}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {heatmapData.map(row => (
                                        <tr key={row.type}>
                                            <td className="py-1.5 px-2 text-[10px] font-mono text-ink-subtle">{formatType(row.type)}</td>
                                            {sevs.map(s => {
                                                const val = (row as any)[s] || 0
                                                const intensity = val > 0 ? Math.min(0.35, 0.08 + (val / globalMax) * 0.27) : 0
                                                const sc = sevColors[s]
                                                return (
                                                    <td key={s} className="text-center py-1.5 px-1">
                                                        {val > 0 ? (
                                                            <span className="inline-flex items-center justify-center w-8 h-6 rounded-sm text-[10px] font-mono font-bold"
                                                                style={{
                                                                    background: sc.bg + intensity + ')',
                                                                    color: sc.text,
                                                                    border: `1px solid ${sc.bg}${Math.min(0.3, intensity + 0.1)})`,
                                                                }}>
                                                                {val}
                                                            </span>
                                                        ) : (
                                                            <span className="text-ink-muted/30">·</span>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="flex items-center gap-2 mt-3 text-[9px] font-mono text-ink-muted">
                                <span>INTENSITY: ↗ AS SEVERITY</span>
                                {sevs.map(s => (
                                    <span key={s} className="w-2 h-2 rounded-sm" style={{ background: sevColors[s].glow }} />
                                ))}
                            </div>
                        </div>
                    )
                })()}
            </div>

            <div className="module module-corners">
                <p className="module-label mb-3">EXPORT_OPERATIONS</p>
                <div className="flex gap-3 flex-wrap">
                <button onClick={() => downloadReport('html').catch(() => addToast('error', 'Failed to download HTML report'))} className="btn-primary">
                    <FileDown size={14} />
                    DOWNLOAD HTML REPORT
                </button>
                <button onClick={() => downloadReport('json').catch(() => addToast('error', 'Failed to download JSON report'))} className="btn-ghost">
                    <FileDown size={14} />
                    DOWNLOAD JSON
                </button>
                <button onClick={() => downloadPDFReport().then(() => addToast('success', 'PDF report downloaded')).catch(() => addToast('warning', 'PDF export requires weasyprint on backend'))} className="btn-ghost">
                    <FileText size={14} />
                    DOWNLOAD PDF
                </button>
                </div>
            </div>
        </div>
    )
}
