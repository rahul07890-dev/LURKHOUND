"""
Misconfiguration Detection Module
Detects Active Directory security misconfigurations.
Each finding includes: description, impact, severity, affected objects.
"""
import logging
import networkx as nx
from typing import List, Dict, Any
from mitre_mapping import get_techniques_for_finding, MITRE_TECHNIQUES

logger = logging.getLogger(__name__)

SEVERITY_CRITICAL = "Critical"
SEVERITY_HIGH = "High"
SEVERITY_MEDIUM = "Medium"
SEVERITY_LOW = "Low"


def _finding(finding_id: str, title: str, description: str, impact: str,
             severity: str, affected: List[str], finding_type: str) -> Dict:
    """Create a structured finding dictionary."""
    return {
        "id": finding_id,
        "title": title,
        "description": description,
        "impact": impact,
        "severity": severity,
        "affected_objects": affected,
        "finding_type": finding_type,
        "mitre_techniques": get_techniques_for_finding(finding_type),
    }


def detect_domain_admin_sprawl(groups: List[Dict], users: List[Dict]) -> List[Dict]:
    """Detect excessive members in the Domain Admins group."""
    findings = []
    dn_to_name = {u['dn']: u.get('sam_account_name', u['dn']) for u in users}

    for group in groups:
        sam_lower = group.get('sam_account_name', '').lower()
        if 'domain admins' in sam_lower or 'enterprise admins' in sam_lower:
            members = group.get('members', [])
            member_names = [dn_to_name.get(m, m.split(',')[0].replace('CN=', '')) for m in members]
            
            if len(members) > 3:
                findings.append(_finding(
                    finding_id=f"DA_SPRAWL_{group.get('sam_account_name', 'DA')}",
                    title=f"Domain Admin Sprawl — {group.get('sam_account_name', 'Domain Admins')}",
                    description=(
                        f"The '{group.get('sam_account_name','')}' group has {len(members)} members. "
                        f"Domain Admin membership should be strictly limited to essential accounts only. "
                        f"Members: {', '.join(member_names[:10])}"
                    ),
                    impact="Any compromised member account grants full domain control. "
                           "Each unnecessary admin account increases the attack surface.",
                    severity=SEVERITY_HIGH if len(members) <= 5 else SEVERITY_CRITICAL,
                    affected=member_names,
                    finding_type="excessive_admin_members"
                ))
    return findings


def detect_genericall_permissions(G: nx.DiGraph) -> List[Dict]:
    """Detect GenericAll permissions — full object control."""
    findings = []
    for src, tgt, data in G.edges(data=True):
        if data.get('edge_type') == 'GenericAll':
            src_data = G.nodes.get(src, {})
            tgt_data = G.nodes.get(tgt, {})
            src_name = src_data.get('sam', src.split(',')[0])
            tgt_name = tgt_data.get('sam', tgt.split(',')[0])
            is_privileged_target = (
                tgt_data.get('is_hvt', False) or 
                tgt_data.get('is_privileged', False) or
                tgt_data.get('is_admin', False)
            )
            severity = SEVERITY_CRITICAL if is_privileged_target else SEVERITY_HIGH
            target_type = tgt_data.get('object_type', 'object')

            findings.append(_finding(
                finding_id=f"GENERIC_ALL_{src_name}_{tgt_name}",
                title=f"GenericAll Permission: {src_name} → {tgt_name}",
                description=(
                    f"'{src_name}' has GenericAll rights on the {target_type.lower()} '{tgt_name}'. "
                    f"GenericAll grants complete control: reset passwords, modify memberships, "
                    f"change ACLs, and write any attribute."
                ),
                impact=(
                    f"Complete takeover of '{tgt_name}'. If it is a privileged "
                    + ("group or user" if target_type != "Computer" else "computer")
                    + ", this can lead to domain privilege escalation."
                ),
                severity=severity,
                affected=[src_name, tgt_name],
                finding_type="generic_all_on_group" if target_type == "Group" else "generic_all_on_user"
            ))
    return findings


def detect_writedacl_permissions(G: nx.DiGraph) -> List[Dict]:
    """Detect WriteDACL permissions — allows modifying object ACLs."""
    findings = []
    for src, tgt, data in G.edges(data=True):
        if data.get('edge_type') == 'WriteDACL':
            src_data = G.nodes.get(src, {})
            tgt_data = G.nodes.get(tgt, {})
            src_name = src_data.get('sam', src.split(',')[0])
            tgt_name = tgt_data.get('sam', tgt.split(',')[0])
            is_privileged_target = tgt_data.get('is_hvt') or tgt_data.get('is_privileged')
            severity = SEVERITY_CRITICAL if is_privileged_target else SEVERITY_HIGH

            findings.append(_finding(
                finding_id=f"WRITEDACL_{src_name}_{tgt_name}",
                title=f"WriteDACL Permission: {src_name} → {tgt_name}",
                description=(
                    f"'{src_name}' has WriteDACL rights on '{tgt_name}'. "
                    f"WriteDACL allows the account to modify the DACL (Discretionary Access Control List) "
                    f"of the target, effectively granting itself any additional rights including GenericAll."
                ),
                impact=f"'{src_name}' can grant itself or any other principal full control over '{tgt_name}', "
                       f"enabling complete object takeover.",
                severity=severity,
                affected=[src_name, tgt_name],
                finding_type="write_dacl"
            ))
    return findings


def detect_writeowner_permissions(G: nx.DiGraph) -> List[Dict]:
    """Detect WriteOwner permissions — allows changing object ownership."""
    findings = []
    for src, tgt, data in G.edges(data=True):
        if data.get('edge_type') == 'WriteOwner':
            src_data = G.nodes.get(src, {})
            tgt_data = G.nodes.get(tgt, {})
            src_name = src_data.get('sam', src.split(',')[0])
            tgt_name = tgt_data.get('sam', tgt.split(',')[0])
            is_privileged_target = tgt_data.get('is_hvt') or tgt_data.get('is_privileged')
            severity = SEVERITY_CRITICAL if is_privileged_target else SEVERITY_HIGH

            findings.append(_finding(
                finding_id=f"WRITEOWNER_{src_name}_{tgt_name}",
                title=f"WriteOwner Permission: {src_name} → {tgt_name}",
                description=(
                    f"'{src_name}' has WriteOwner rights on '{tgt_name}'. "
                    f"WriteOwner allows setting a new owner for the object, after which the new owner "
                    f"can modify the DACL to grant additional access."
                ),
                impact=f"Chain attack: WriteOwner → take ownership → WriteDACL → GenericAll on '{tgt_name}'.",
                severity=severity,
                affected=[src_name, tgt_name],
                finding_type="write_owner"
            ))
    return findings


def detect_nested_group_escalation(G: nx.DiGraph, groups: List[Dict]) -> List[Dict]:
    """Detect over-privileged nested group memberships."""
    findings = []

    for group in groups:
        sam = group.get('sam_account_name', '')
        if group.get('attributes', {}).get('is_privileged') and group.get('member_of'):
            parent_groups = group.get('member_of', [])
            is_da_path = any(
                'domain admins' in pg.lower() or 'enterprise admins' in pg.lower()
                for pg in parent_groups
            )
            if parent_groups:
                findings.append(_finding(
                    finding_id=f"NESTED_{sam}",
                    title=f"Over-Privileged Nested Group: {sam}",
                    description=(
                        f"The privileged group '{sam}' is nested within other groups: "
                        f"{', '.join(parent_groups[:3])}. Nested group memberships can "
                        f"grant unintended inherited privileges to all members of the outer groups."
                    ),
                    impact="Users in outer groups inherit all privileges of the inner group, "
                           "potentially gaining escalated access unintentionally.",
                    severity=SEVERITY_HIGH if is_da_path else SEVERITY_MEDIUM,
                    affected=[sam] + parent_groups[:3],
                    finding_type="nested_group_escalation"
                ))
    return findings


def detect_password_never_expires(users: List[Dict]) -> List[Dict]:
    """Detect privileged accounts with password never expires set."""
    findings = []
    affected = []

    for user in users:
        is_admin = (
            user.get('attributes', {}).get('is_admin', False) or
            user.get('attributes', {}).get('adminCount') == '1'
        )
        never_expires = user.get('attributes', {}).get('is_password_never_expires', False)
        if is_admin and never_expires:
            affected.append(user.get('sam_account_name', user['dn']))

    if affected:
        findings.append(_finding(
            finding_id="PWD_NEVER_EXPIRES_ADMIN",
            title="Privileged Accounts with Password Never Expires",
            description=(
                f"{len(affected)} privileged account(s) have the 'Password Never Expires' flag set: "
                f"{', '.join(affected)}. Admin accounts with non-rotating passwords are high-risk "
                f"targets as compromised credentials remain valid indefinitely."
            ),
            impact="Permanent compromise if credentials are obtained. No natural expiry forces rotation.",
            severity=SEVERITY_HIGH,
            affected=affected,
            finding_type="domain_admin_member"
        ))
    return findings


def detect_genericwrite_permissions(G: nx.DiGraph) -> List[Dict]:
    """Detect GenericWrite permissions — allows writing arbitrary attributes."""
    findings = []
    for src, tgt, data in G.edges(data=True):
        if data.get('edge_type') == 'GenericWrite':
            src_data = G.nodes.get(src, {})
            tgt_data = G.nodes.get(tgt, {})
            src_name = src_data.get('sam', src.split(',')[0])
            tgt_name = tgt_data.get('sam', tgt.split(',')[0])

            findings.append(_finding(
                finding_id=f"GENERICWRITE_{src_name}_{tgt_name}",
                title=f"GenericWrite Permission: {src_name} → {tgt_name}",
                description=(
                    f"'{src_name}' has GenericWrite rights on '{tgt_name}'. "
                    f"This allows writing to any non-protected attribute, such as adding SPNs "
                    f"for Kerberoasting or modifying logon scripts."
                ),
                impact="Enables Kerberoasting (via SPN addition), logon script abuse, or shadow credentials attack.",
                severity=SEVERITY_HIGH,
                affected=[src_name, tgt_name],
                finding_type="generic_write"
            ))
    return findings


def detect_kerberoastable_users(users: List[Dict]) -> List[Dict]:
    """Detect users with SPNs set (Kerberoastable) who are privileged."""
    findings = []
    kerberoastable_admins = []

    for user in users:
        has_spn = user.get('attributes', {}).get('has_spn', False)
        is_admin = (
            user.get('attributes', {}).get('is_admin', False) or 
            user.get('attributes', {}).get('adminCount') == '1'
        )
        if has_spn and is_admin:
            kerberoastable_admins.append(user.get('sam_account_name', ''))

    if kerberoastable_admins:
        findings.append(_finding(
            finding_id="KERBEROASTABLE_ADMINS",
            title="Kerberoastable Privileged Accounts",
            description=(
                f"{len(kerberoastable_admins)} privileged account(s) have Service Principal Names (SPNs) set: "
                f"{', '.join(kerberoastable_admins)}. These accounts are vulnerable to Kerberoasting — "
                f"an offline password cracking attack using Kerberos TGS tickets."
            ),
            impact="Offline cracking of service account passwords can give attackers privileged domain access.",
            severity=SEVERITY_CRITICAL,
            affected=kerberoastable_admins,
            finding_type="acl_permission_abuse"
        ))
    return findings


# ── Phase 1: Feature 7 — AS-REP Roasting ──────────────────────────────────────

def detect_asrep_roastable(users: List[Dict]) -> List[Dict]:
    """Detect accounts with Kerberos pre-authentication disabled (AS-REP roastable)."""
    findings = []
    affected = []
    for user in users:
        attrs = user.get('attributes', {})
        if attrs.get('is_asrep_roastable', False) and not attrs.get('is_disabled', False):
            affected.append(user.get('sam_account_name', user['dn']))
    if affected:
        is_priv = any(
            u.get('attributes', {}).get('is_admin', False)
            for u in users
            if u.get('sam_account_name', '') in affected
        )
        findings.append(_finding(
            finding_id="ASREP_ROASTABLE",
            title="AS-REP Roastable Accounts (Pre-Auth Disabled)",
            description=(
                f"{len(affected)} account(s) have 'Do not require Kerberos preauthentication' enabled: "
                f"{', '.join(affected[:10])}. An attacker can request AS-REP tickets for these accounts "
                f"and crack them offline without any authentication."
            ),
            impact="Offline password cracking without needing valid credentials. "
                   "If privileged accounts are affected, full domain compromise is possible.",
            severity=SEVERITY_CRITICAL if is_priv else SEVERITY_HIGH,
            affected=affected,
            finding_type="asrep_roastable"
        ))
    return findings


# ── Phase 1: Feature 10 — Password Policy Analysis ───────────────────────────

def detect_weak_password_policies(password_policies: List[Dict]) -> List[Dict]:
    """Flag weak password policies."""
    findings = []
    for pol in password_policies:
        issues = []
        name = pol.get('name', 'Unknown Policy')
        min_len = pol.get('min_length', 0)
        if min_len < 8:
            issues.append(f"Minimum password length is {min_len} (recommended: ≥14)")
        if not pol.get('complexity_enabled', False):
            issues.append("Password complexity requirements are disabled")
        if pol.get('lockout_threshold', 0) == 0:
            issues.append("Account lockout is disabled (unlimited password attempts)")
        elif pol.get('lockout_threshold', 0) > 10:
            issues.append(f"Account lockout threshold is {pol['lockout_threshold']} (recommended: ≤5)")
        if pol.get('history_length', 0) < 12:
            issues.append(f"Password history is {pol.get('history_length', 0)} (recommended: ≥24)")

        if issues:
            sev = SEVERITY_CRITICAL if min_len < 8 and not pol.get('complexity_enabled') else SEVERITY_HIGH
            findings.append(_finding(
                finding_id=f"WEAK_PWD_POLICY_{name.replace(' ', '_').upper()}",
                title=f"Weak Password Policy: {name}",
                description=f"The password policy '{name}' has the following weaknesses: " + "; ".join(issues) + ".",
                impact="Weak password policies enable brute-force attacks, credential stuffing, and password spraying.",
                severity=sev,
                affected=[name] + (pol.get('applies_to', []) or []),
                finding_type="weak_password_policy"
            ))
    return findings


# ── Phase 1: Feature 11 — Stale Object Cleanup ───────────────────────────────

def detect_stale_computers(computers: List[Dict]) -> List[Dict]:
    """Detect computers with no login in 90+ days."""
    import time
    findings = []
    stale = []
    now = time.time()
    threshold = 90 * 24 * 60 * 60  # 90 days in seconds
    # Windows FILETIME epoch offset (Jan 1, 1601 to Jan 1, 1970)
    EPOCH_DIFF = 11644473600

    for comp in computers:
        attrs = comp.get('attributes', {})
        last_logon = attrs.get('lastLogon') or attrs.get('lastLogonTimestamp') or '0'
        try:
            ll = int(last_logon)
            if ll > 0:
                unix_ts = (ll / 10_000_000) - EPOCH_DIFF
                if (now - unix_ts) > threshold:
                    stale.append(comp.get('sam_account_name', comp['dn']))
        except (ValueError, TypeError):
            pass

    if stale:
        findings.append(_finding(
            finding_id="STALE_COMPUTERS",
            title=f"Stale Computer Accounts ({len(stale)} with no login in 90+ days)",
            description=(
                f"{len(stale)} computer account(s) have not logged in for over 90 days: "
                f"{', '.join(stale[:10])}{'...' if len(stale) > 10 else ''}. "
                f"These may be decommissioned systems that still have valid machine accounts."
            ),
            impact="Stale computer accounts can be hijacked for lateral movement, "
                   "credential relay attacks, or re-used machine account passwords.",
            severity=SEVERITY_MEDIUM,
            affected=stale,
            finding_type="stale_computer"
        ))
    return findings


def detect_stale_disabled_members(users: List[Dict], groups: List[Dict]) -> List[Dict]:
    """Detect disabled accounts that are still members of security groups."""
    findings = []
    disabled_dns = set()
    disabled_names = {}
    for u in users:
        if u.get('attributes', {}).get('is_disabled', False):
            disabled_dns.add(u['dn'])
            disabled_names[u['dn']] = u.get('sam_account_name', u['dn'])

    affected_pairs = []
    for g in groups:
        for m_dn in g.get('members', []):
            if m_dn in disabled_dns:
                affected_pairs.append(
                    f"{disabled_names.get(m_dn, m_dn)} in {g.get('sam_account_name', g['dn'])}"
                )

    if affected_pairs:
        findings.append(_finding(
            finding_id="STALE_DISABLED_MEMBERS",
            title=f"Disabled Accounts Still in Groups ({len(affected_pairs)} memberships)",
            description=(
                f"{len(affected_pairs)} disabled account(s) are still members of security groups: "
                f"{'; '.join(affected_pairs[:5])}{'...' if len(affected_pairs) > 5 else ''}."
            ),
            impact="Disabled accounts in groups can be re-enabled by attackers who gain the ability to modify them. "
                   "The group memberships grant immediate privileges upon re-enablement.",
            severity=SEVERITY_MEDIUM,
            affected=[p.split(' in ')[0] for p in affected_pairs],
            finding_type="stale_disabled_member"
        ))
    return findings


def detect_empty_groups(groups: List[Dict]) -> List[Dict]:
    """Detect security groups with zero members."""
    findings = []
    empty = []
    for g in groups:
        attrs = g.get('attributes', {})
        is_security = attrs.get('is_privileged', False) or attrs.get('is_admin', False)
        if not g.get('members', []) and is_security:
            empty.append(g.get('sam_account_name', g['dn']))

    if empty:
        findings.append(_finding(
            finding_id="EMPTY_SECURITY_GROUPS",
            title=f"Empty Privileged/Security Groups ({len(empty)})",
            description=(
                f"{len(empty)} privileged or security group(s) have no members: "
                f"{', '.join(empty[:10])}. Empty privileged groups are typically vestigial and should be reviewed."
            ),
            impact="Empty privileged groups can be populated by attackers who gain WriteDACL or GenericAll permissions.",
            severity=SEVERITY_LOW,
            affected=empty,
            finding_type="empty_security_group"
        ))
    return findings


# ── Phase 1: Feature 12 — Shadow Admin Detection ─────────────────────────────

def detect_shadow_admins(G: nx.DiGraph, groups: List[Dict]) -> List[Dict]:
    """Find accounts with admin-equivalent ACL permissions but not in any admin group."""
    findings = []
    # Identify official admin group members
    admin_group_members = set()
    for g in groups:
        sam_lower = g.get('sam_account_name', '').lower()
        if any(p in sam_lower for p in ['domain admins', 'enterprise admins', 'administrators',
                                          'schema admins', 'account operators', 'server operators']):
            for m_dn in g.get('members', []):
                admin_group_members.add(m_dn)

    # Find nodes with dangerous outgoing edges to privileged targets NOT in admin groups
    DANGEROUS_EDGES = {'GenericAll', 'WriteDACL', 'WriteOwner'}
    shadow = []
    for src, tgt, data in G.edges(data=True):
        if data.get('edge_type') not in DANGEROUS_EDGES:
            continue
        src_data = G.nodes.get(src, {})
        tgt_data = G.nodes.get(tgt, {})
        if src_data.get('object_type') != 'User':
            continue
        if src in admin_group_members:
            continue  # legitimate admin
        if not (tgt_data.get('is_hvt') or tgt_data.get('is_privileged') or tgt_data.get('is_admin')):
            continue  # target is not privileged
        src_sam = src_data.get('sam', src)
        tgt_sam = tgt_data.get('sam', tgt)
        shadow.append(f"{src_sam} → {data.get('edge_type')} → {tgt_sam}")

    if shadow:
        affected_users = list(set(s.split(' →')[0] for s in shadow))
        findings.append(_finding(
            finding_id="SHADOW_ADMINS",
            title=f"Shadow Admin Accounts ({len(affected_users)} users)",
            description=(
                f"{len(affected_users)} account(s) have admin-equivalent ACL permissions on privileged objects "
                f"but are NOT members of any official admin group: {'; '.join(shadow[:5])}"
                f"{'...' if len(shadow) > 5 else ''}."
            ),
            impact="Shadow admins are extremely dangerous because they wield admin-level power without "
                   "appearing in standard admin group audits. They are invisible to most security reviews.",
            severity=SEVERITY_CRITICAL,
            affected=affected_users,
            finding_type="shadow_admin"
        ))
    return findings


# ── Phase 1: Feature 9 — Trust Relationship Issues ───────────────────────────

def detect_trust_issues(trusts: List[Dict]) -> List[Dict]:
    """Detect risky trust relationships."""
    findings = []
    for t in trusts:
        issues = []
        name = t.get('name', 'Unknown')
        direction = t.get('trust_direction', '')
        partner = t.get('trust_partner', name)

        if direction == 'Bidirectional':
            issues.append("Bidirectional trust allows authentication in both directions")
        if t.get('sid_filtering_disabled', False):
            issues.append("SID filtering is disabled — enables SID History injection attacks")

        if issues:
            sev = SEVERITY_HIGH if t.get('sid_filtering_disabled') else SEVERITY_MEDIUM
            ft = "trust_no_sid_filtering" if t.get('sid_filtering_disabled') else "trust_bidirectional"
            findings.append(_finding(
                finding_id=f"TRUST_RISK_{name.replace('.', '_').upper()}",
                title=f"Risky Trust: {partner} ({direction})",
                description=(
                    f"Trust relationship with '{partner}' ({direction}, type: {t.get('trust_type', 'Unknown')}): "
                    + "; ".join(issues) + "."
                ),
                impact="Trusts can be abused for cross-domain privilege escalation, "
                       "especially when SID filtering is disabled.",
                severity=sev,
                affected=[partner],
                finding_type=ft
            ))
    return findings


def run_all_detections(G: nx.DiGraph, users: List[Dict], groups: List[Dict],
                      computers: List[Dict],
                      password_policies: List[Dict] = None,
                      trusts: List[Dict] = None) -> List[Dict]:
    """Run all misconfiguration detection modules."""
    all_findings = []

    # Original detectors
    all_findings.extend(detect_domain_admin_sprawl(groups, users))
    all_findings.extend(detect_genericall_permissions(G))
    all_findings.extend(detect_writedacl_permissions(G))
    all_findings.extend(detect_writeowner_permissions(G))
    all_findings.extend(detect_nested_group_escalation(G, groups))
    all_findings.extend(detect_password_never_expires(users))
    all_findings.extend(detect_genericwrite_permissions(G))
    all_findings.extend(detect_kerberoastable_users(users))

    # Phase 1 detectors
    all_findings.extend(detect_asrep_roastable(users))
    all_findings.extend(detect_weak_password_policies(password_policies or []))
    all_findings.extend(detect_stale_computers(computers))
    all_findings.extend(detect_stale_disabled_members(users, groups))
    all_findings.extend(detect_empty_groups(groups))
    all_findings.extend(detect_shadow_admins(G, groups))
    all_findings.extend(detect_trust_issues(trusts or []))

    # Deduplicate by ID
    seen_ids = set()
    unique_findings = []
    for f in all_findings:
        if f['id'] not in seen_ids:
            seen_ids.add(f['id'])
            unique_findings.append(f)

    # Sort by severity
    severity_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    unique_findings.sort(key=lambda f: severity_order.get(f['severity'], 4))

    logger.info(f"Detected {len(unique_findings)} misconfigurations")
    return unique_findings
