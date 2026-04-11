'use client'
import { useState, useEffect, useCallback, ReactNode } from 'react'
import { Info, X, Shield, GitFork, AlertTriangle, Crosshair } from 'lucide-react'
import PantherIcon from '@/components/PantherIcon'

const STEPS = [
    {
        title: 'Welcome to LurkHound',
        desc: 'Your Active Directory reconnaissance and attack-path discovery dashboard.',
        icon: PantherIcon,
    },
    {
        title: 'Enter Credentials',
        desc: 'Provide your AD domain, DC IP, username and password to begin enumeration.',
        icon: Shield,
    },
    {
        title: 'Explore Attack Paths',
        desc: 'Visualize privilege escalation chains from users to high-value targets.',
        icon: GitFork,
    },
    {
        title: 'Review Findings',
        desc: 'Identify misconfigurations and get step-by-step remediation guidance with PowerShell commands.',
        icon: AlertTriangle,
    },
    {
        title: 'Take Action',
        desc: 'Track remediation progress, export reports, and compare scan results over time.',
        icon: Crosshair,
    },
]

export function OnboardingTour({ children }: { children: ReactNode }) {
    const [step, setStep] = useState(-1) // -1 = not started / dismissed
    const [dismissed, setDismissed] = useState(true)

    useEffect(() => {
        const seen = localStorage.getItem('lurkhound_onboarded')
        if (!seen) {
            setStep(0)
            setDismissed(false)
        }
    }, [])

    const next = useCallback(() => {
        if (step >= STEPS.length - 1) {
            localStorage.setItem('lurkhound_onboarded', '1')
            setDismissed(true)
            setStep(-1)
        } else {
            setStep(s => s + 1)
        }
    }, [step])

    const skip = useCallback(() => {
        localStorage.setItem('lurkhound_onboarded', '1')
        setDismissed(true)
        setStep(-1)
    }, [])

    if (dismissed || step < 0) return <>{children}</>

    const current = STEPS[step]
    const Icon = current.icon

    return (
        <>
            {children}
            {/* Overlay */}
            <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-bg-card border border-bg-border rounded-xl shadow-2xl max-w-md w-full p-6 relative">
                    <button onClick={skip}
                        className="absolute top-3 right-3 text-ink-muted hover:text-ink transition-colors">
                        <X size={16} />
                    </button>

                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                            <Icon size={24} className="text-accent" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-ink mb-1">{current.title}</h3>
                            <p className="text-sm text-ink-muted leading-relaxed">{current.desc}</p>
                        </div>

                        {/* Progress dots */}
                        <div className="flex gap-1.5">
                            {STEPS.map((_, i) => (
                                <div key={i}
                                    className="w-2 h-2 rounded-full transition-all duration-300"
                                    style={{
                                        background: i === step ? '#ef4444' : i < step ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)',
                                        transform: i === step ? 'scale(1.3)' : 'scale(1)',
                                    }} />
                            ))}
                        </div>

                        <div className="flex gap-3 w-full">
                            <button onClick={skip}
                                className="btn-ghost flex-1 text-xs">
                                Skip Tour
                            </button>
                            <button onClick={next}
                                className="btn-primary flex-1 text-xs">
                                {step >= STEPS.length - 1 ? 'Get Started' : 'Next'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
