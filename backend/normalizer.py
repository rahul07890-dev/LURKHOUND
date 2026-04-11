"""
Data Normalization Module
Normalizes and cleans raw LDAP enumeration data.
- Normalize SIDs and Distinguished Names
- Remove duplicates
- Categorize object types
- Validate relationship integrity
"""
import re
import logging
from typing import List, Dict, Any, Set, Tuple

logger = logging.getLogger(__name__)

# Well-known SIDs
WELL_KNOWN_SIDS = {
    "S-1-1-0": "Everyone",
    "S-1-5-7": "Anonymous Logon",
    "S-1-5-11": "Authenticated Users",
    "S-1-5-18": "SYSTEM",
    "S-1-5-19": "LOCAL SERVICE",
    "S-1-5-20": "NETWORK SERVICE",
    "S-1-5-32-544": "Administrators",
    "S-1-5-32-545": "Users",
    "S-1-5-32-546": "Guests",
    "S-1-5-32-551": "Backup Operators",
    "S-1-5-32-548": "Account Operators",
    "S-1-5-32-549": "Server Operators",
    "S-1-5-32-550": "Print Operators",
    "S-1-5-32-552": "Replicators",
    "S-1-5-32-554": "Pre-Windows 2000 Compatible Access",
    "S-1-5-32-555": "Remote Desktop Users",
    "S-1-5-32-556": "Network Configuration Operators",
    "S-1-5-32-557": "Incoming Forest Trust Builders",
    "S-1-5-32-558": "Performance Monitor Users",
    "S-1-5-32-559": "Performance Log Users",
    "S-1-5-32-560": "Windows Authorization Access Group",
    "S-1-5-32-562": "Distributed COM Users",
    "S-1-5-32-569": "Cryptographic Operators",
    "S-1-5-32-573": "Event Log Readers",
    "S-1-5-32-574": "Certificate Service DCOM Access",
    "S-1-5-32-575": "RDS Remote Access Servers",
    "S-1-5-32-576": "RDS Endpoint Servers",
    "S-1-5-32-577": "RDS Management Servers",
    "S-1-5-32-578": "Hyper-V Administrators",
    "S-1-5-32-579": "Access Control Assistance Operators",
    "S-1-5-32-580": "Remote Management Users",
}

# Privileged group name patterns
PRIVILEGED_GROUP_PATTERNS = [
    r"domain admins",
    r"enterprise admins",
    r"schema admins",
    r"administrators",
    r"account operators",
    r"backup operators",
    r"server operators",
    r"print operators",
    r"domain controllers",
    r"group policy creator owners",
    r"dnseadmins",
    r"exchange.*admin",
]


def normalize_dn(dn: str) -> str:
    """Normalize a Distinguished Name to uppercase and strip extra spaces."""
    if not dn:
        return ""
    # Normalize spacing around commas
    dn = re.sub(r'\s*,\s*', ',', dn.strip())
    return dn.upper()


def extract_cn_from_dn(dn: str) -> str:
    """Extract the CN (Common Name) from a DN."""
    if not dn:
        return ""
    match = re.match(r'^CN=([^,]+)', dn, re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.match(r'^[^=]+=([^,]+)', dn, re.IGNORECASE)
    if match:
        return match.group(1)
    return dn.split(',')[0]


def is_privileged_group(name: str) -> bool:
    """Check if a group is considered privileged."""
    name_lower = name.lower()
    for pattern in PRIVILEGED_GROUP_PATTERNS:
        if re.search(pattern, name_lower):
            return True
    return False


def is_domain_controller(obj: Dict) -> bool:
    """Check if a computer object is a Domain Controller."""
    uac = int(obj.get('attributes', {}).get('userAccountControl', 0) or 0)
    return bool(uac & 0x2000)  # SERVER_TRUST_ACCOUNT flag


def normalize_users(users: List[Dict]) -> List[Dict]:
    """Normalize user objects."""
    normalized = []
    seen_dns = set()

    for user in users:
        dn_upper = normalize_dn(user.get('dn', ''))
        if dn_upper in seen_dns:
            continue
        seen_dns.add(dn_upper)

        sam = user.get('sam_account_name', '').strip()
        if not sam:
            sam = extract_cn_from_dn(user.get('dn', ''))

        uac = int(user.get('attributes', {}).get('userAccountControl', 512) or 512)
        is_disabled = bool(uac & 0x2)
        is_password_never_expires = bool(uac & 0x10000)
        is_asrep_roastable = bool(uac & 0x400000)  # DONT_REQUIRE_PREAUTH

        normalized_user = {
            "dn": dn_upper,
            "sam_account_name": sam.upper(),
            "display_name": user.get('display_name', '') or sam,
            "description": user.get('description', ''),
            "object_type": "User",
            "sid": user.get('sid', ''),
            "member_of": [normalize_dn(m) for m in user.get('member_of', [])],
            "members": [],
            "attributes": {
                **user.get('attributes', {}),
                "is_disabled": is_disabled,
                "is_password_never_expires": is_password_never_expires,
                "is_admin": str(user.get('attributes', {}).get('adminCount', '0')) == '1',
                "has_spn": len(user.get('attributes', {}).get('servicePrincipalName', [])) > 0,
                "is_asrep_roastable": is_asrep_roastable,
            }
        }
        normalized.append(normalized_user)

    return normalized


def normalize_groups(groups: List[Dict]) -> List[Dict]:
    """Normalize group objects."""
    normalized = []
    seen_dns = set()

    for group in groups:
        dn_upper = normalize_dn(group.get('dn', ''))
        if dn_upper in seen_dns:
            continue
        seen_dns.add(dn_upper)

        sam = group.get('sam_account_name', '').strip()
        if not sam:
            sam = extract_cn_from_dn(group.get('dn', ''))

        normalized_group = {
            "dn": dn_upper,
            "sam_account_name": sam.upper(),
            "display_name": group.get('display_name', '') or sam,
            "description": group.get('description', ''),
            "object_type": "Group",
            "sid": group.get('sid', ''),
            "members": [normalize_dn(m) for m in group.get('members', [])],
            "member_of": [normalize_dn(m) for m in group.get('member_of', [])],
            "attributes": {
                **group.get('attributes', {}),
                "is_privileged": is_privileged_group(sam),
                "is_admin": str(group.get('attributes', {}).get('adminCount', '0')) == '1',
            }
        }
        normalized.append(normalized_group)

    return normalized


def normalize_computers(computers: List[Dict]) -> List[Dict]:
    """Normalize computer objects."""
    normalized = []
    seen_dns = set()

    for comp in computers:
        dn_upper = normalize_dn(comp.get('dn', ''))
        if dn_upper in seen_dns:
            continue
        seen_dns.add(dn_upper)

        sam = comp.get('sam_account_name', '').strip().rstrip('$')
        if not sam:
            sam = extract_cn_from_dn(comp.get('dn', ''))

        uac = int(comp.get('attributes', {}).get('userAccountControl', 0) or 0)
        is_dc = bool(uac & 0x2000)
        is_trusted_deleg = bool(uac & 0x80000)  # unconstrained delegation

        # Constrained delegation targets
        raw_attrs = comp.get('attributes', {})
        allowed_to_delegate = raw_attrs.get('msDS-AllowedToDelegateTo', []) or []
        if isinstance(allowed_to_delegate, str):
            allowed_to_delegate = [allowed_to_delegate]
        rbcd_raw = raw_attrs.get('msDS-AllowedToActOnBehalfOfOtherIdentity', None)
        has_rbcd = rbcd_raw is not None and rbcd_raw != b'' and rbcd_raw != ''

        normalized_comp = {
            "dn": dn_upper,
            "sam_account_name": sam.upper(),
            "display_name": comp.get('display_name', '') or sam,
            "description": comp.get('description', ''),
            "object_type": "Computer",
            "sid": comp.get('sid', ''),
            "member_of": [normalize_dn(m) for m in comp.get('member_of', [])],
            "members": [],
            "attributes": {
                **raw_attrs,
                "is_domain_controller": is_dc,
                "os": raw_attrs.get('operatingSystem', 'Unknown'),
                "hostname": raw_attrs.get('dNSHostName', sam),
                "is_trusted_for_delegation": is_trusted_deleg,
                "allowed_to_delegate_to": allowed_to_delegate,
                "has_rbcd": has_rbcd,
            }
        }
        normalized.append(normalized_comp)

    return normalized


def normalize_acls(acls: List[Dict], all_objects: List[Dict]) -> List[Dict]:
    """Normalize ACL entries and resolve source/target types."""
    # Build quick lookup by DN
    dn_type_map = {}
    dn_name_map = {}
    for obj in all_objects:
        dn_key = obj['dn'].upper()
        dn_type_map[dn_key] = obj['object_type']
        dn_name_map[dn_key] = obj.get('sam_account_name', obj.get('display_name', ''))

    normalized = []
    seen = set()

    for acl in acls:
        source = normalize_dn(acl.get('source', ''))
        target = normalize_dn(acl.get('target', ''))
        perm = acl.get('permission', '')

        key = (source, target, perm)
        if key in seen:
            continue
        seen.add(key)

        source_type = dn_type_map.get(source, acl.get('source_type', 'Unknown'))
        target_type = dn_type_map.get(target, acl.get('target_type', 'Unknown'))

        source_name = dn_name_map.get(source, extract_cn_from_dn(acl.get('source', '')))
        target_name = dn_name_map.get(target, extract_cn_from_dn(acl.get('target', '')))

        normalized.append({
            "source": source,
            "source_name": source_name,
            "target": target,
            "target_name": target_name or acl.get('target_name', ''),
            "permission": perm,
            "source_type": source_type,
            "target_type": target_type
        })

    return normalized


def build_dn_to_object_map(all_objects: List[Dict]) -> Dict[str, Dict]:
    """Build a dictionary mapping normalized DN to object."""
    return {obj['dn'].upper(): obj for obj in all_objects}


def validate_relationships(users: List[Dict], groups: List[Dict], computers: List[Dict]) -> None:
    """
    Validate that memberOf/member references point to existing objects.
    Removes invalid references.
    """
    all_dns = set()
    for obj in users + groups + computers:
        all_dns.add(obj['dn'].upper())

    fixed = 0
    for obj in users + groups + computers:
        original_member_of = obj.get('member_of', [])
        obj['member_of'] = [dn for dn in original_member_of if dn in all_dns]
        fixed += len(original_member_of) - len(obj['member_of'])

        if 'members' in obj:
            original_members = obj.get('members', [])
            obj['members'] = [dn for dn in original_members if dn in all_dns]
            fixed += len(original_members) - len(obj['members'])

    logger.info(f"Removed {fixed} invalid DN references during validation")


def normalize_all(raw_data: Dict) -> Dict:
    """Run full normalization pipeline on raw enumeration data."""
    logger.info("Starting data normalization pipeline")

    users = normalize_users(raw_data.get('users', []))
    groups = normalize_groups(raw_data.get('groups', []))
    computers = normalize_computers(raw_data.get('computers', []))

    validate_relationships(users, groups, computers)

    all_objects = users + groups + computers
    acls = normalize_acls(raw_data.get('acls', []), all_objects)

    logger.info(f"Normalization complete: {len(users)} users, {len(groups)} groups, "
                f"{len(computers)} computers, {len(acls)} ACL entries")

    return {
        "users": users,
        "groups": groups,
        "computers": computers,
        "acls": acls,
        "dn_map": build_dn_to_object_map(all_objects),
        # Pass through Phase 1 data unchanged
        "gpos": raw_data.get('gpos', []),
        "ous": raw_data.get('ous', []),
        "trusts": raw_data.get('trusts', []),
        "password_policies": raw_data.get('password_policies', []),
    }
