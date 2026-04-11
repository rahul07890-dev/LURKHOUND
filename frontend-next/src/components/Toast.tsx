'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'
type Toast = { id: string; type: ToastType; message: string; duration?: number }
type ToastCtx = { addToast: (type: ToastType, message: string, duration?: number) => void }

const ToastContext = createContext<ToastCtx>({ addToast: () => {} })
export const useToast = () => useContext(ToastContext)

const ICONS: Record<ToastType, React.ElementType> = {
    success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info,
}
const COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    warning: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
    info: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
        const id = Math.random().toString(36).slice(2)
        setToasts(prev => [...prev, { id, type, message, duration }])
        if (duration > 0) setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration)
    }, [])

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
                style={{ maxWidth: 380 }}>
                {toasts.map(t => {
                    const Icon = ICONS[t.type]
                    const c = COLORS[t.type]
                    return (
                        <div key={t.id}
                            className="pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md animate-slideUp"
                            style={{
                                background: c.bg,
                                border: `1px solid ${c.border}`,
                                animation: 'slideUp 0.3s ease-out',
                            }}>
                            <Icon size={16} style={{ color: c.text, marginTop: 1, flexShrink: 0 }} />
                            <p className="text-sm text-ink flex-1" style={{ lineHeight: '1.4' }}>{t.message}</p>
                            <button onClick={() => dismiss(t.id)}
                                className="text-ink-muted hover:text-ink transition-colors flex-shrink-0 mt-0.5">
                                <X size={14} />
                            </button>
                        </div>
                    )
                })}
            </div>
        </ToastContext.Provider>
    )
}
