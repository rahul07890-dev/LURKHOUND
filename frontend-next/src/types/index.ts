/**
 * Shared TypeScript types for the LurkHound frontend.
 *
 * All domain models live here so that api.ts, pages, and components
 * import from a single source of truth.
 */

// ── AD Object ─────────────────────────────────────────────────────────────────

export type ADObject = {
    dn: string
    sam_account_name: string
    display_name?: string
    object_type: string
    attributes: Record<string, unknown>
    member_of?: string[]
    members?: string[]
    description?: string
}

// ── Attack-Path Models ────────────────────────────────────────────────────────

export type PathEdge = {
    from: string
    from_type: string
    to: string
    to_type: string
    type: string
    label: string
}

export type MitreTechnique = {
    id: string
    name: string
    tactic: string
    url: string
    description: string
}

export type AttackPath = {
    path: string[]
    path_dns: string[]
    edges: PathEdge[]
    chain: string
    severity: string
    description: string
    mitre_techniques: MitreTechnique[]
    length: number
    source: string
    target: string
    target_type: string
    path_type: string
}

// ── Findings ──────────────────────────────────────────────────────────────────

export type Finding = {
    id: string
    title: string
    severity: string
    description: string
    impact: string
    affected_objects: string[]
    finding_type: string
    mitre_techniques: MitreTechnique[]
    /** fix_guidance text (multi-line numbered steps) */
    remediation?: string
    /** ready-to-run powershell command */
    powershell_fix?: string
    /** what the vulnerability is */
    explanation?: string
    /** what removing it achieves */
    risk_reduction?: string
}

export type FindingStatus = 'open' | 'acknowledged' | 'in_progress' | 'fixed' | 'accepted_risk'

// ── Graph ─────────────────────────────────────────────────────────────────────

export type GraphNode = {
    id: string
    label: string
    object_type: string
    sam: string
    is_hvt: boolean
    is_admin: boolean
    is_domain_controller: boolean
    is_privileged: boolean
}

export type GraphEdge = {
    source: string
    target: string
    type: string
    label: string
    weight: number
}

export type GraphData = {
    nodes: GraphNode[]
    edges: GraphEdge[]
}

// ── Session ───────────────────────────────────────────────────────────────────

export type Summary = {
    total_users: number
    total_groups: number
    total_computers: number
    privileged_accounts: number
    domain_admins: string[]
    attack_paths_found: number
    findings_count: number
    risk_score: number
    risk_level: string
    domain: string
    dc_ip: string
}

export type SessionData = {
    session_id: string
    users: ADObject[]
    groups: ADObject[]
    computers: ADObject[]
    attack_paths: AttackPath[]
    findings: Finding[]
    graph: GraphData
    summary: Summary
    gpos?: ADObject[]
    ous?: ADObject[]
    trusts?: ADObject[]
    password_policies?: ADObject[]
}

// ── Scan History ──────────────────────────────────────────────────────────────

export type ScanHistoryEntry = {
    id: number
    domain: string
    dc_ip: string
    timestamp: string
    risk_score: number
    risk_level: string
    paths_count: number
    findings_count: number
}
