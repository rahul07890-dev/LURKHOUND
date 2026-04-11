// lib/api.ts — API client matching the actual FastAPI backend

// ── Types (re-exported from shared types module) ──────────────────────────────

export type {
    ADObject,
    PathEdge,
    MitreTechnique,
    AttackPath,
    Finding,
    FindingStatus,
    GraphNode,
    GraphEdge,
    GraphData,
    Summary,
    SessionData,
    ScanHistoryEntry,
} from '@/types'

import type {
    SessionData,
    Finding,
    FindingStatus,
    ScanHistoryEntry,
    GraphData,
    Summary,
} from '@/types'

// ── Session ID storage (in-memory, not localStorage) ─────────────────────────

let _sessionId: string | null = null
export const getSessionId = () => _sessionId
export const clearSessionId = () => { _sessionId = null }

// ── Core fetch ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const resp = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        ...init,
    })
    if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(body?.detail ?? `HTTP ${resp.status}`)
    }
    return resp.json() as Promise<T>
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function login(payload: {
    dc_ip: string
    domain: string
    username: string
    password: string
    use_ldaps: boolean
}): Promise<SessionData> {
    // Step 1: authenticate and get session_id
    const auth = await apiFetch<{ success: boolean; session_id: string; message: string; summary: Summary }>(
        '/authenticate',
        { method: 'POST', body: JSON.stringify(payload) }
    )
    _sessionId = auth.session_id

    // Step 2: fetch all data in one bundle request
    const data = await apiFetch<Omit<SessionData, 'session_id'>>(`/data/${_sessionId}`)

    return { session_id: _sessionId, ...data }
}

export async function logout(): Promise<void> {
    if (_sessionId) {
        await apiFetch(`/logout/${_sessionId}`, { method: 'POST' }).catch(() => { })
        clearSessionId()
    }
}

export async function checkHealth(): Promise<{ status: string }> {
    return apiFetch<{ status: string }>('/health')  // note: /health is at root in main.py
}

// ── Phase 2: Scan History ─────────────────────────────────────────────────────

export async function getScans(limit = 50): Promise<ScanHistoryEntry[]> {
    const res = await apiFetch<{ scans: ScanHistoryEntry[] }>(`/scans?limit=${limit}`)
    return res.scans
}

export async function getScan(scanId: number): Promise<Record<string, unknown>> {
    return apiFetch(`/scans/${scanId}`)
}

export async function diffScans(id1: number, id2: number): Promise<Record<string, unknown>> {
    return apiFetch(`/scans/diff/${id1}/${id2}`)
}

// ── Phase 2: Shortest Path ────────────────────────────────────────────────────

export async function getShortestPath(source: string, target: string): Promise<{
    path: string[]; edges: { from: string; to: string; type: string; label: string }[];
    length: number; message?: string
}> {
    return apiFetch(`/path/${_sessionId}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`)
}

// ── Phase 3: Report Export ────────────────────────────────────────────────────

export async function downloadReport(format: 'html' | 'json' = 'html'): Promise<void> {
    try {
        const resp = await fetch(`/api/report/${_sessionId}?format=${format}`)
        if (!resp.ok) {
            const errText = await resp.text().catch(() => resp.statusText)
            console.error('Report download failed:', resp.status, errText)
            alert(`Report download failed: ${resp.status} ${errText}`)
            return
        }
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = format === 'html' ? 'ad_security_report.html' : 'ad_security_report.json'
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        }, 100)
    } catch (err) {
        console.error('Report download error:', err)
        alert('Failed to download report. Make sure the backend server is running.')
    }
}

// ── Phase 3: BloodHound Export ────────────────────────────────────────────────

export async function downloadBloodHoundExport(): Promise<void> {
    try {
        const resp = await fetch(`/api/export/bloodhound/${_sessionId}`)
        if (!resp.ok) {
            const errText = await resp.text().catch(() => resp.statusText)
            console.error('BloodHound export failed:', resp.status, errText)
            alert(`BloodHound export failed: ${resp.status} ${errText}`)
            return
        }
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'bloodhound_export.json'
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        }, 100)
    } catch (err) {
        console.error('BloodHound export error:', err)
        alert('Failed to export BloodHound data. Make sure the backend server is running.')
    }
}

// ── Phase 4: Finding Status ───────────────────────────────────────────────────

export async function getFindingStatuses(): Promise<Record<string, FindingStatus>> {
    const res = await apiFetch<{ statuses: Record<string, FindingStatus> }>(`/finding-status/${_sessionId}`)
    return res.statuses
}

export async function updateFindingStatus(findingId: string, status: FindingStatus): Promise<void> {
    await apiFetch(`/finding-status/${_sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ finding_id: findingId, status }),
    })
}

// ── CSV Export ──────────────────────────────────────────────────────────────────

export function exportFindingsCSV(findings: Finding[], statuses: Record<string, FindingStatus>): void {
    const headers = ['Severity', 'Title', 'Description', 'Affected Objects', 'Status', 'MITRE IDs', 'Finding Type']
    const rows = findings.map(f => [
        f.severity,
        `"${(f.title || '').replace(/"/g, '""')}"`,
        `"${(f.description || '').replace(/"/g, '""')}"`,
        `"${(f.affected_objects || []).join('; ')}"`,
        statuses[f.id] || 'open',
        `"${(f.mitre_techniques || []).map(t => t.id).join(', ')}"`,
        f.finding_type,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lurkhound_findings_${new Date().toISOString().slice(0, 10)}.csv`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
}

// ── PDF Report download ─────────────────────────────────────────────────────────

export async function downloadPDFReport(): Promise<void> {
    try {
        const resp = await fetch(`/api/report/${_sessionId}?format=pdf`)
        if (!resp.ok) {
            const errText = await resp.text().catch(() => resp.statusText)
            throw new Error(errText)
        }
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'ad_security_report.pdf'
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
    } catch (err) {
        console.error('PDF download error:', err)
        throw err
    }
}

