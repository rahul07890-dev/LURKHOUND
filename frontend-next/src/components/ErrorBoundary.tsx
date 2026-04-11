'use client'
import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

type Props = { children: ReactNode; fallbackMessage?: string }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
                    <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-ink mb-1">
                            {this.props.fallbackMessage || 'Something went wrong'}
                        </p>
                        <p className="text-xs text-ink-muted max-w-sm">
                            {this.state.error?.message || 'An unexpected error occurred.'}
                        </p>
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="btn-ghost text-xs gap-1.5"
                    >
                        <RotateCcw size={12} /> Try Again
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
