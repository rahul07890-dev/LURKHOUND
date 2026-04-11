'use client'
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { SessionData } from '@/lib/api'

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
    const clear = useCallback(() => setSession(null), [])
    return <Ctx.Provider value={{ session, setSession, clear }}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
