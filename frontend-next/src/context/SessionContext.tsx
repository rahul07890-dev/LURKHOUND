'use client'
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { SessionData, getSessionId, clearSessionId } from '@/lib/api'

type SessionCtx = {
    session: SessionData | null
    setSession: (s: SessionData | null) => void
    clear: () => void
}

const Ctx = createContext<SessionCtx>({
    session: null,
    setSession: () => { },
    clear: () => { },
})

export function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<SessionData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const id = getSessionId()
        if (id && !session) {
            fetch(`/api/data/${id}`)
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(data => setSession({ session_id: id, ...data }))
                .catch(() => clearSessionId())
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [session])

    const clear = useCallback(() => {
        setSession(null)
        clearSessionId()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-[#0f172a] text-slate-400 font-mono text-sm">
                <div className="animate-pulse">Restoring secure session...</div>
            </div>
        )
    }

    return <Ctx.Provider value={{ session, setSession, clear }}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
