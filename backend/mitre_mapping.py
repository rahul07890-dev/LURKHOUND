"""
MITRE ATT&CK Mapping Module
Maps detected attack patterns and findings to MITRE ATT&CK technique IDs.
Reference: https://attack.mitre.org/
"""

# MITRE ATT&CK Enterprise Techniques relevant to AD abuse
MITRE_TECHNIQUES = {
    "T1078": {
        "id": "T1078",
        "name": "Valid Accounts",
        "tactic": "Defense Evasion, Persistence, Privilege Escalation, Initial Access",
        "url": "https://attack.mitre.org/techniques/T1078/",
        "description": "Adversaries may obtain and abuse credentials of existing accounts."
    },
    "T1078.002": {
        "id": "T1078.002",
        "name": "Valid Accounts: Domain Accounts",
        "tactic": "Defense Evasion, Persistence, Privilege Escalation, Initial Access",
        "url": "https://attack.mitre.org/techniques/T1078/002/",
        "description": "Adversaries may obtain and abuse credentials of a domain account."
    },
    "T1484": {
        "id": "T1484",
        "name": "Domain Policy Modification",
        "tactic": "Defense Evasion, Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1484/",
        "description": "Adversaries may modify the configuration settings of a domain to evade defenses."
    },
    "T1484.001": {
        "id": "T1484.001",
        "name": "Domain Policy Modification: Group Policy Object Modification",
        "tactic": "Defense Evasion, Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1484/001/",
        "description": "Adversaries may modify Group Policy Objects (GPOs) to subvert domain-level permissions."
    },
    "T1098": {
        "id": "T1098",
        "name": "Account Manipulation",
        "tactic": "Persistence, Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1098/",
        "description": "Adversaries may manipulate accounts to maintain access or escalate privileges."
    },
    "T1098.001": {
        "id": "T1098.001",
        "name": "Account Manipulation: Additional Cloud Credentials",
        "tactic": "Persistence, Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1098/001/",
        "description": "Adversaries may add adversary-controlled credentials to a compromised account."
    },
    "T1087": {
        "id": "T1087",
        "name": "Account Discovery",
        "tactic": "Discovery",
        "url": "https://attack.mitre.org/techniques/T1087/",
        "description": "Adversaries may attempt to get a listing of valid accounts."
    },
    "T1087.002": {
        "id": "T1087.002",
        "name": "Account Discovery: Domain Account",
        "tactic": "Discovery",
        "url": "https://attack.mitre.org/techniques/T1087/002/",
        "description": "Adversaries may attempt to get a listing of domain accounts."
    },
    "T1069": {
        "id": "T1069",
        "name": "Permission Groups Discovery",
        "tactic": "Discovery",
        "url": "https://attack.mitre.org/techniques/T1069/",
        "description": "Adversaries may attempt to find group and permission settings."
    },
    "T1069.002": {
        "id": "T1069.002",
        "name": "Permission Groups Discovery: Domain Groups",
        "tactic": "Discovery",
        "url": "https://attack.mitre.org/techniques/T1069/002/",
        "description": "Adversaries may attempt to find domain-level groups and permission settings."
    },
    "T1134": {
        "id": "T1134",
        "name": "Access Token Manipulation",
        "tactic": "Defense Evasion, Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1134/",
        "description": "Adversaries may modify access tokens to operate under a different user context."
    },
    "T1021": {
        "id": "T1021",
        "name": "Remote Services",
        "tactic": "Lateral Movement",
        "url": "https://attack.mitre.org/techniques/T1021/",
        "description": "Adversaries may use valid accounts to log into a service remotely."
    },
    "T1021.002": {
        "id": "T1021.002",
        "name": "Remote Services: SMB/Windows Admin Shares",
        "tactic": "Lateral Movement",
        "url": "https://attack.mitre.org/techniques/T1021/002/",
        "description": "Adversaries may use Valid Accounts to interact with a remote network share."
    },
    "T1207": {
        "id": "T1207",
        "name": "Rogue Domain Controller",
        "tactic": "Defense Evasion",
        "url": "https://attack.mitre.org/techniques/T1207/",
        "description": "Adversaries may register a rogue Domain Controller to enable manipulation of AD data."
    },
    "T1136": {
        "id": "T1136",
        "name": "Create Account",
        "tactic": "Persistence",
        "url": "https://attack.mitre.org/techniques/T1136/",
        "description": "Adversaries may create an account to maintain access to victim systems."
    },
    "T1003": {
        "id": "T1003",
        "name": "OS Credential Dumping",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1003/",
        "description": "Adversaries may attempt to dump credentials to obtain account login information."
    },
    "T1558": {
        "id": "T1558",
        "name": "Steal or Forge Kerberos Tickets",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1558/",
        "description": "Adversaries may attempt to subvert Kerberos authentication."
    },
    "T1222": {
        "id": "T1222",
        "name": "File and Directory Permissions Modification",
        "tactic": "Defense Evasion",
        "url": "https://attack.mitre.org/techniques/T1222/",
        "description": "Adversaries may modify file or directory permissions/attributes."
    },
    "T1574": {
        "id": "T1574",
        "name": "Hijack Execution Flow",
        "tactic": "Defense Evasion, Persistence, Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1574/",
        "description": "Adversaries may execute their own malicious payloads by hijacking the way operating systems run programs."
    },
    "T1003.006": {
        "id": "T1003.006",
        "name": "OS Credential Dumping: DCSync",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1003/006/",
        "description": "Adversaries may attempt to access credentials and other sensitive information by abusing a Windows Domain Controller's application programming interface (API) to simulate the replication process from a remote domain controller using a technique called DCSync."
    },
    "T1558.003": {
        "id": "T1558.003",
        "name": "Steal or Forge Kerberos Tickets: Kerberoasting",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1558/003/",
        "description": "Adversaries may abuse a valid Kerberos ticket-granting ticket (TGT) or sniff network traffic to obtain a ticket-granting service (TGS) ticket that may be vulnerable to Brute Force."
    },
    "T1558.001": {
        "id": "T1558.001",
        "name": "Steal or Forge Kerberos Tickets: Golden Ticket",
        "tactic": "Credential Access, Persistence",
        "url": "https://attack.mitre.org/techniques/T1558/001/",
        "description": "Adversaries who have the KRBTGT account password hash may forge Kerberos ticket-granting tickets (TGT)."
    },
    "T1550.002": {
        "id": "T1550.002",
        "name": "Use Alternate Authentication Material: Pass the Hash",
        "tactic": "Defense Evasion, Lateral Movement",
        "url": "https://attack.mitre.org/techniques/T1550/002/",
        "description": "Adversaries may 'pass the hash' using stolen password hashes to move laterally within an environment."
    },
    "T1110": {
        "id": "T1110",
        "name": "Brute Force",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1110/",
        "description": "Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained."
    },
    "T1021.006": {
        "id": "T1021.006",
        "name": "Remote Services: Windows Remote Management",
        "tactic": "Lateral Movement",
        "url": "https://attack.mitre.org/techniques/T1021/006/",
        "description": "Adversaries may use Valid Accounts to interact with remote systems using Windows Remote Management (WinRM)."
    },
    "T1484.001": {
        "id": "T1484.001",
        "name": "Domain Policy Modification: Group Policy Object Modification",
        "tactic": "Defense Evasion, Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1484/001/",
        "description": "Adversaries may modify Group Policy Objects (GPOs) to subvert domain-level permissions."
    },
    "T1558.004": {
        "id": "T1558.004",
        "name": "Steal or Forge Kerberos Tickets: AS-REP Roasting",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1558/004/",
        "description": "Adversaries may reveal credentials of accounts that have disabled Kerberos preauthentication by sending AS-REQ messages without the encrypted timestamp."
    },
    "T1550.003": {
        "id": "T1550.003",
        "name": "Use Alternate Authentication Material: Pass the Ticket",
        "tactic": "Defense Evasion, Lateral Movement",
        "url": "https://attack.mitre.org/techniques/T1550/003/",
        "description": "Adversaries may pass stolen Kerberos tickets to move laterally in an environment."
    },
    "T1187": {
        "id": "T1187",
        "name": "Forced Authentication",
        "tactic": "Credential Access",
        "url": "https://attack.mitre.org/techniques/T1187/",
        "description": "Adversaries may gather credential material by invoking or forcing a user to automatically provide authentication."
    },
    "T1482": {
        "id": "T1482",
        "name": "Domain Trust Discovery",
        "tactic": "Discovery",
        "url": "https://attack.mitre.org/techniques/T1482/",
        "description": "Adversaries may attempt to gather information on domain trust relationships that may be used to identify lateral movement opportunities."
    },
    "T1134.005": {
        "id": "T1134.005",
        "name": "Access Token Manipulation: SID-History Injection",
        "tactic": "Defense Evasion, Privilege Escalation",
        "url": "https://attack.mitre.org/techniques/T1134/005/",
        "description": "Adversaries may use SID-History Injection to escalate privileges and bypass access controls."
    },
}

# Mapping from finding/detection type to MITRE techniques
FINDING_TO_TECHNIQUES = {
    "generic_all_on_user": ["T1098", "T1078.002"],
    "generic_all_on_group": ["T1098", "T1069.002", "T1484"],
    "write_dacl": ["T1222", "T1484", "T1098"],
    "write_owner": ["T1222", "T1098"],
    "domain_admin_member": ["T1078.002", "T1087.002"],
    "nested_group_escalation": ["T1069.002", "T1078.002"],
    "local_admin_privilege": ["T1021.002", "T1078"],
    "excessive_admin_members": ["T1078.002", "T1087.002"],
    "user_to_domain_admin_path": ["T1078.002", "T1069.002", "T1098"],
    "generic_write": ["T1098", "T1134"],
    "allowed_to_delegate": ["T1558", "T1078"],
    "unconstrained_delegation": ["T1558.001" if "T1558.001" in MITRE_TECHNIQUES else "T1558", "T1207"],
    "lateral_movement_risk": ["T1021", "T1021.002"],
    "acl_permission_abuse": ["T1222", "T1484"],
    # Phase 1 additions
    "asrep_roastable": ["T1558.004", "T1110"],
    "constrained_delegation": ["T1550.003", "T1558"],
    "rbcd_abuse": ["T1550.003", "T1187"],
    "gpo_abuse": ["T1484.001", "T1098"],
    "trust_bidirectional": ["T1482", "T1134.005"],
    "trust_no_sid_filtering": ["T1134.005", "T1482"],
    "weak_password_policy": ["T1110", "T1078.002"],
    "stale_computer": ["T1078", "T1021.002"],
    "stale_disabled_member": ["T1078.002", "T1098"],
    "empty_security_group": ["T1069.002"],
    "shadow_admin": ["T1098", "T1078.002", "T1222"],
}


# ── Path-type → specific MITRE technique IDs ─────────────────────────────────
PATH_TYPE_TECHNIQUES = {
    "admin_to_dc":                   ["T1021.002", "T1078",     "T1003.006", "T1558.001"],
    "admin_to_workstation":          ["T1021.002", "T1078",     "T1550.002"],
    "dcsync_risk":                   ["T1003.006", "T1003",     "T1558.001", "T1078"],
    "kerberoast_escalation":         ["T1558.003", "T1110",     "T1078.002"],
    "generic_all_abuse":             ["T1098",     "T1078.002", "T1484"],
    "write_dacl_abuse":              ["T1222",     "T1484",     "T1098"],
    "write_owner_abuse":             ["T1222",     "T1098"],
    "generic_write_abuse":           ["T1098",     "T1134",     "T1558.003"],
    "nested_group_da_escalation":    ["T1069.002", "T1078.002"],
    "user_to_domain_admin":          ["T1078.002", "T1069.002", "T1098"],
    "unconstrained_delegation":      ["T1558",     "T1207"],
    "stale_privileged_credential":   ["T1078.002", "T1110",     "T1550.002"],
    "lateral_movement":              ["T1021.002", "T1078"],
    "acl_abuse":                     ["T1222",     "T1484",     "T1098"],
    "domain_admin_escalation":       ["T1078.002", "T1069.002"],
    # Phase 1 additions
    "constrained_delegation":        ["T1550.003", "T1558"],
    "rbcd_abuse":                    ["T1550.003", "T1187"],
    "gpo_abuse":                     ["T1484.001", "T1098"],
    "asrep_roast":                   ["T1558.004", "T1110"],
}


def get_techniques_for_finding(finding_type: str) -> list:
    """Get list of MITRE technique objects for a given finding type."""
    technique_ids = FINDING_TO_TECHNIQUES.get(finding_type, [])
    return [MITRE_TECHNIQUES[tid] for tid in technique_ids if tid in MITRE_TECHNIQUES]


def get_techniques_for_path(path_edges: list, path_type: str = "", extra: list = None) -> list:
    """
    Return MITRE technique objects for a path.
    If path_type is given, use the PATH_TYPE_TECHNIQUES mapping for specific results.
    Falls back to edge-type heuristics.
    Extra is a list of additional technique IDs to always include.
    """
    technique_ids: set = set(extra or [])

    # Path-type specific mapping (most specific)
    if path_type and path_type in PATH_TYPE_TECHNIQUES:
        technique_ids.update(PATH_TYPE_TECHNIQUES[path_type])
    else:
        # Fallback: derive from edge types
        for edge in path_edges:
            etype = edge.get("type", "").lower()
            if "genericall" in etype:
                technique_ids.update(["T1098", "T1078.002", "T1484"])
            elif "writedacl" in etype:
                technique_ids.update(["T1222", "T1484"])
            elif "writeowner" in etype:
                technique_ids.update(["T1222", "T1098"])
            elif "memberof" in etype:
                technique_ids.update(["T1069.002"])
            elif "adminto" in etype:
                technique_ids.update(["T1021.002", "T1078"])
            elif "genericwrite" in etype:
                technique_ids.update(["T1098", "T1134"])
            elif "kerberoast" in etype or "spn" in etype:
                technique_ids.update(["T1558.003", "T1110"])

    return [MITRE_TECHNIQUES[tid] for tid in sorted(technique_ids) if tid in MITRE_TECHNIQUES]


def format_technique_badge(technique: dict) -> str:
    """Format a technique for display."""
    return f"{technique['id']} — {technique['name']}"
