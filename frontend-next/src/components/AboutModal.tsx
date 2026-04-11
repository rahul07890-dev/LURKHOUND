'use client'
import { useState } from 'react'
import { X, Shield, GitFork, AlertTriangle, Globe, Cpu, Keyboard } from 'lucide-react'
import PantherIcon from '@/components/PantherIcon'

const MITRE_COVERAGE = [
    'T1078.002 — Valid Accounts: Domain Accounts',
    'T1098 — Account Manipulation',
    'T1069.002 — Permission Groups Discovery',
    'T1087.002 — Account Discovery',
    'T1222 — File/Directory Permissions Modification',
    'T1484 — Domain Policy Modification',
    'T1558 — Steal/Forge Kerberos Tickets',
    'T1003.006 — OS Credential Dumping: DCSync',
    'T1558.003 — Kerberoasting',
    'T1558.004 — AS-REP Roasting',
    'T1134.005 — SID-History Injection',
    'T1021.002 — Remote Services: SMB',
]

const SHORTCUTS = [
    { keys: 'Ctrl + K', action: 'Open Global Search' },
    { keys: 'Ctrl + E', action: 'Export Report' },
    { keys: 'Esc', action: 'Close Modals & Drawers' },
]

export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [tab, setTab] = useState<'about' | 'mitre' | 'shortcuts'>('about')

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bg-card border border-bg-border rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-bg-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                            <PantherIcon size={20} className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-ink">LurkHound</h2>
                            <p className="text-xs text-ink-muted">v1.0.0 — AD Attack-Path Discovery Mapper</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0 border-b border-bg-border">
                    {([['about', 'About'], ['mitre', 'MITRE Coverage'], ['shortcuts', 'Shortcuts']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setTab(key)}
                            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${tab === key ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {tab === 'about' && (
                        <div className="space-y-4 text-sm text-ink-subtle leading-relaxed">
                            <p>
                                LurkHound is a post-compromise Active Directory reconnaissance tool that performs
                                LDAP enumeration, builds permission graphs, discovers privilege escalation paths,
                                and generates remediation guidance with MITRE ATT&CK tagging.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { icon: Shield, label: 'Zero Credential Storage', desc: 'Passwords cleared after auth' },
                                    { icon: Globe, label: 'LDAPS Encryption', desc: 'TLS over port 636' },
                                    { icon: GitFork, label: 'Attack Path Analysis', desc: 'BFS/DFS path discovery' },
                                    { icon: AlertTriangle, label: 'Misconfig Detection', desc: 'ACL, delegation, GPO abuse' },
                                ].map(item => (
                                    <div key={item.label} className="p-3 rounded-lg bg-bg-raised border border-bg-border">
                                        <item.icon size={14} className="text-accent mb-1.5" />
                                        <p className="text-xs font-semibold text-ink">{item.label}</p>
                                        <p className="text-[10px] text-ink-muted">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-2 flex items-center gap-2 text-[10px] text-ink-muted">
                                <Cpu size={10} />
                                <span>Platform: Windows | Python 3.10+ | Next.js | FastAPI</span>
                            </div>
                        </div>
                    )}
                    {tab === 'mitre' && (
                        <div className="space-y-1.5">
                            {MITRE_COVERAGE.map(t => (
                                <div key={t} className="flex items-start gap-2 py-1.5 border-b border-bg-border/50 last:border-0">
                                    <span className="badge-mitre text-[9px] mt-0.5 flex-shrink-0">{t.split(' — ')[0]}</span>
                                    <span className="text-xs text-ink-subtle">{t.split(' — ')[1]}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {tab === 'shortcuts' && (
                        <div className="space-y-2">
                            {SHORTCUTS.map(s => (
                                <div key={s.keys} className="flex items-center justify-between py-2 border-b border-bg-border/50 last:border-0">
                                    <span className="text-sm text-ink">{s.action}</span>
                                    <kbd className="px-2 py-1 rounded bg-bg-raised border border-bg-border text-xs font-mono text-ink-muted">{s.keys}</kbd>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
