'use client'

export function SkeletonPulse({ className = '' }: { className?: string }) {
    return (
        <div className={`skeleton-pulse rounded ${className}`}
            style={{ background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-raised) 50%, var(--bg-card) 75%)', backgroundSize: '200% 100%' }} />
    )
}

/** Skeleton for a stat card */
export function SkeletonStatCard() {
    return (
        <div className="module p-4">
            <SkeletonPulse className="w-4 h-4 mb-2" />
            <SkeletonPulse className="w-16 h-8 mb-1.5" />
            <SkeletonPulse className="w-12 h-3" />
        </div>
    )
}

/** Skeleton for a finding card */
export function SkeletonFindingCard() {
    return (
        <div className="card p-4 space-y-3">
            <div className="flex items-center gap-3">
                <SkeletonPulse className="w-16 h-5 rounded-full" />
                <SkeletonPulse className="flex-1 h-4" />
            </div>
            <SkeletonPulse className="w-3/4 h-3" />
        </div>
    )
}

/** Skeleton for the risk gauge */
export function SkeletonGauge() {
    return (
        <div className="flex flex-col items-center gap-3 py-6">
            <SkeletonPulse className="w-40 h-40 rounded-full" />
            <SkeletonPulse className="w-32 h-3" />
        </div>
    )
}

/** Skeleton for a list row */
export function SkeletonRow() {
    return (
        <div className="flex items-center gap-3 py-2">
            <SkeletonPulse className="w-3 h-3 rounded-full flex-shrink-0" />
            <SkeletonPulse className="flex-1 h-4" />
            <SkeletonPulse className="w-12 h-4" />
        </div>
    )
}
