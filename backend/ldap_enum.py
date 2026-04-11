"""
LDAP Enumeration Module — MARVEL.local
Enumerates Users, Groups, Computers, Group Memberships, and ACL permissions
using the authenticated LDAP connection.
"""
import logging
from typing import List, Dict, Any, Optional
from ldap3 import Connection, SUBTREE, ALL_ATTRIBUTES, ALL_OPERATIONAL_ATTRIBUTES
from ldap3.core.exceptions import LDAPException

logger = logging.getLogger(__name__)

# LDAP filters
# AD computer accounts are also objectClass=user — must explicitly exclude them from user queries
FILTER_USERS = "(&(objectClass=user)(!(objectClass=computer)))"
FILTER_ALL_USERS = "(&(objectClass=user)(!(objectClass=computer)))"
FILTER_GROUPS = "(objectClass=group)"
# Computer objects: use both filters for maximum compatibility
FILTER_COMPUTERS = "(objectClass=computer)"

# Attributes to fetch
USER_ATTRIBUTES = [
    "sAMAccountName", "displayName", "distinguishedName", "objectSid",
    "memberOf", "description", "userAccountControl", "mail",
    "pwdLastSet", "lastLogon", "adminCount", "objectClass",
    "servicePrincipalName", "userPrincipalName", "objectGUID"
]

GROUP_ATTRIBUTES = [
    "sAMAccountName", "displayName", "distinguishedName", "objectSid",
    "member", "memberOf", "description", "adminCount",
    "groupType", "objectClass", "objectGUID", "managedBy"
]

COMPUTER_ATTRIBUTES = [
    "sAMAccountName", "displayName", "distinguishedName", "objectSid",
    "memberOf", "description", "operatingSystem", "operatingSystemVersion",
    "operatingSystemServicePack", "dNSHostName", "userAccountControl",
    "objectClass", "objectGUID", "lastLogon", "lastLogonTimestamp",
    "servicePrincipalName", "objectCategory",
    "msDS-AllowedToDelegateTo", "msDS-AllowedToActOnBehalfOfOtherIdentity",
]

ACL_ATTRIBUTES = [
    "nTSecurityDescriptor", "distinguishedName", "sAMAccountName", "objectSid"
]

# Dangerous ACE types to look for
DANGEROUS_RIGHTS = {
    0xF01FF: "GenericAll",
    0x00020044: "WriteDACL",
    0x00080000: "WriteOwner",
    0x40000000: "GenericWrite",
    0x00000010: "WriteProperty",
    0x000F003F: "GenericAll",
}

# Extended rights GUIDs
EXT_RIGHT_GUIDS = {
    "00299570-246d-11d0-a768-00aa006e0529": "User-Force-Change-Password",
    "45ec5156-db7e-47bb-b53f-dbeb2d03c40f": "Reanimate-Tombstones",
    "1131f6aa-9c07-11d1-f79f-00c04fc2dcd2": "DS-Replication-Get-Changes",
    "1131f6ab-9c07-11d1-f79f-00c04fc2dcd2": "DS-Replication-Synchronize",
    "1131f6ac-9c07-11d1-f79f-00c04fc2dcd2": "DS-Replication-Manage-Topology",
    "89e95b76-444d-4c62-991a-0facbeda640c": "DS-Replication-Get-Changes-In-Filtered-Set",
    "1131f6ad-9c07-11d1-f79f-00c04fc2dcd2": "DS-Replication-Get-Changes-All",
}


def _safe_str(val) -> str:
    """Safely convert LDAP value to string."""
    if val is None:
        return ""
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    return str(val)


def _sid_to_str(sid_bytes) -> str:
    """Convert binary SID to string representation."""
    if not sid_bytes:
        return ""
    try:
        if isinstance(sid_bytes, str):
            return sid_bytes
        # Parse binary SID
        revision = sid_bytes[0]
        sub_auth_count = sid_bytes[1]
        authority = int.from_bytes(sid_bytes[2:8], "big")
        sub_auths = []
        for i in range(sub_auth_count):
            offset = 8 + i * 4
            sub_auth = int.from_bytes(sid_bytes[offset:offset + 4], "little")
            sub_auths.append(str(sub_auth))
        return f"S-{revision}-{authority}-{'-'.join(sub_auths)}"
    except Exception:
        return ""


def enumerate_users(conn: Connection, base_dn: str) -> List[Dict[str, Any]]:
    """Enumerate all user objects from AD."""
    users = []
    try:
        conn.search(
            search_base=base_dn,
            search_filter=FILTER_ALL_USERS,
            search_scope=SUBTREE,
            attributes=USER_ATTRIBUTES
        )
        for entry in conn.entries:
            user = {
                "dn": _safe_str(entry.distinguishedName.value),
                "sam_account_name": _safe_str(entry.sAMAccountName.value) if hasattr(entry, 'sAMAccountName') else "",
                "display_name": _safe_str(entry.displayName.value) if hasattr(entry, 'displayName') else "",
                "description": _safe_str(entry.description.value) if hasattr(entry, 'description') else "",
                "object_type": "User",
                "sid": _sid_to_str(entry.objectSid.value) if hasattr(entry, 'objectSid') and entry.objectSid.value else "",
                "member_of": [_safe_str(m) for m in (entry.memberOf.values if hasattr(entry, 'memberOf') and entry.memberOf.values else [])],
                "attributes": {
                    "userAccountControl": str(entry.userAccountControl.value) if hasattr(entry, 'userAccountControl') else "",
                    "adminCount": str(entry.adminCount.value) if hasattr(entry, 'adminCount') else "0",
                    "mail": _safe_str(entry.mail.value) if hasattr(entry, 'mail') else "",
                    "userPrincipalName": _safe_str(entry.userPrincipalName.value) if hasattr(entry, 'userPrincipalName') else "",
                    "servicePrincipalName": [_safe_str(s) for s in (entry.servicePrincipalName.values if hasattr(entry, 'servicePrincipalName') and entry.servicePrincipalName.values else [])],
                }
            }
            users.append(user)
        logger.info(f"Enumerated {len(users)} users")
    except LDAPException as e:
        logger.error(f"Error enumerating users: {e}")
    return users


def enumerate_groups(conn: Connection, base_dn: str) -> List[Dict[str, Any]]:
    """Enumerate all group objects from AD."""
    groups = []
    try:
        conn.search(
            search_base=base_dn,
            search_filter=FILTER_GROUPS,
            search_scope=SUBTREE,
            attributes=GROUP_ATTRIBUTES
        )
        for entry in conn.entries:
            group = {
                "dn": _safe_str(entry.distinguishedName.value),
                "sam_account_name": _safe_str(entry.sAMAccountName.value) if hasattr(entry, 'sAMAccountName') else "",
                "display_name": _safe_str(entry.displayName.value) if hasattr(entry, 'displayName') else "",
                "description": _safe_str(entry.description.value) if hasattr(entry, 'description') else "",
                "object_type": "Group",
                "sid": _sid_to_str(entry.objectSid.value) if hasattr(entry, 'objectSid') and entry.objectSid.value else "",
                "members": [_safe_str(m) for m in (entry.member.values if hasattr(entry, 'member') and entry.member.values else [])],
                "member_of": [_safe_str(m) for m in (entry.memberOf.values if hasattr(entry, 'memberOf') and entry.memberOf.values else [])],
                "attributes": {
                    "adminCount": str(entry.adminCount.value) if hasattr(entry, 'adminCount') else "0",
                    "groupType": str(entry.groupType.value) if hasattr(entry, 'groupType') else "",
                }
            }
            groups.append(group)
        logger.info(f"Enumerated {len(groups)} groups")
    except LDAPException as e:
        logger.error(f"Error enumerating groups: {e}")
    return groups


def enumerate_computers(conn: Connection, base_dn: str) -> List[Dict[str, Any]]:
    """Enumerate all computer objects from AD."""
    computers = []
    try:
        conn.search(
            search_base=base_dn,
            search_filter=FILTER_COMPUTERS,
            search_scope=SUBTREE,
            attributes=COMPUTER_ATTRIBUTES
        )
        raw_count = len(conn.entries)
        logger.info(f"Computer LDAP query returned {raw_count} raw entries")

        for entry in conn.entries:
            sam = _safe_str(entry.sAMAccountName.value) if hasattr(entry, 'sAMAccountName') else ""
            # Computer accounts end in $ — keep the $ in raw but normalizer strips it
            uac = 0
            try:
                uac = int(entry.userAccountControl.value) if hasattr(entry, 'userAccountControl') and entry.userAccountControl.value else 0
            except Exception:
                pass
            is_dc = bool(uac & 0x2000)   # SERVER_TRUST_ACCOUNT

            computer = {
                "dn": _safe_str(entry.distinguishedName.value),
                "sam_account_name": sam,
                "display_name": _safe_str(entry.displayName.value) if hasattr(entry, 'displayName') else sam.rstrip('$'),
                "description": _safe_str(entry.description.value) if hasattr(entry, 'description') else "",
                "object_type": "Computer",
                "sid": _sid_to_str(entry.objectSid.value) if hasattr(entry, 'objectSid') and entry.objectSid.value else "",
                "member_of": [_safe_str(m) for m in (entry.memberOf.values if hasattr(entry, 'memberOf') and entry.memberOf.values else [])],
                "attributes": {
                    "operatingSystem":        _safe_str(entry.operatingSystem.value) if hasattr(entry, 'operatingSystem') else "",
                    "operatingSystemVersion": _safe_str(entry.operatingSystemVersion.value) if hasattr(entry, 'operatingSystemVersion') else "",
                    "dNSHostName":            _safe_str(entry.dNSHostName.value) if hasattr(entry, 'dNSHostName') else "",
                    "userAccountControl":     str(uac),
                    "is_domain_controller":   is_dc,
                    "is_trusted_for_delegation": bool(uac & 0x80000),
                }
            }
            computers.append(computer)

        logger.info(f"Enumerated {len(computers)} computers")
    except LDAPException as e:
        logger.error(f"Error enumerating computers: {e}")
    return computers


def enumerate_gpos(conn: Connection, base_dn: str) -> List[Dict[str, Any]]:
    """Enumerate Group Policy Objects."""
    gpos = []
    try:
        conn.search(
            search_base=base_dn,
            search_filter="(objectClass=groupPolicyContainer)",
            search_scope=SUBTREE,
            attributes=["displayName", "distinguishedName", "gPCFileSysPath",
                        "flags", "versionNumber", "whenCreated", "whenChanged"]
        )
        for entry in conn.entries:
            gpos.append({
                "dn": _safe_str(entry.distinguishedName.value),
                "display_name": _safe_str(entry.displayName.value) if hasattr(entry, 'displayName') else "",
                "object_type": "GPO",
                "gpc_path": _safe_str(entry.gPCFileSysPath.value) if hasattr(entry, 'gPCFileSysPath') else "",
                "flags": str(entry.flags.value) if hasattr(entry, 'flags') and entry.flags.value else "0",
            })
        logger.info(f"Enumerated {len(gpos)} GPOs")
    except LDAPException as e:
        logger.warning(f"GPO enumeration error: {e}")
    return gpos


def enumerate_ous(conn: Connection, base_dn: str) -> List[Dict[str, Any]]:
    """Enumerate Organizational Units and their linked GPOs."""
    ous = []
    try:
        conn.search(
            search_base=base_dn,
            search_filter="(objectClass=organizationalUnit)",
            search_scope=SUBTREE,
            attributes=["name", "distinguishedName", "gPLink", "description"]
        )
        for entry in conn.entries:
            gp_link = _safe_str(entry.gPLink.value) if hasattr(entry, 'gPLink') and entry.gPLink.value else ""
            # Parse gPLink format: [LDAP://cn={GUID},cn=policies,...;0][...]
            linked_gpos = []
            if gp_link:
                import re
                for m in re.finditer(r'\[LDAP://([^;]+);(\d+)\]', gp_link, re.IGNORECASE):
                    linked_gpos.append({"dn": m.group(1), "enforced": m.group(2) == "2"})
            ous.append({
                "dn": _safe_str(entry.distinguishedName.value),
                "name": _safe_str(entry.name.value) if hasattr(entry, 'name') else "",
                "description": _safe_str(entry.description.value) if hasattr(entry, 'description') else "",
                "object_type": "OU",
                "linked_gpos": linked_gpos,
            })
        logger.info(f"Enumerated {len(ous)} OUs")
    except LDAPException as e:
        logger.warning(f"OU enumeration error: {e}")
    return ous


def enumerate_trusts(conn: Connection, base_dn: str) -> List[Dict[str, Any]]:
    """Enumerate domain trust relationships."""
    trusts = []
    TRUST_DIR = {0: "Disabled", 1: "Inbound", 2: "Outbound", 3: "Bidirectional"}
    TRUST_TYPE = {1: "Downlevel", 2: "Uplevel", 3: "MIT", 4: "DCE"}
    try:
        conn.search(
            search_base=base_dn,
            search_filter="(objectClass=trustedDomain)",
            search_scope=SUBTREE,
            attributes=["name", "distinguishedName", "trustDirection",
                        "trustType", "trustAttributes", "securityIdentifier",
                        "flatName", "trustPartner"]
        )
        for entry in conn.entries:
            td = int(entry.trustDirection.value) if hasattr(entry, 'trustDirection') and entry.trustDirection.value else 0
            tt = int(entry.trustType.value) if hasattr(entry, 'trustType') and entry.trustType.value else 0
            ta = int(entry.trustAttributes.value) if hasattr(entry, 'trustAttributes') and entry.trustAttributes.value else 0
            trusts.append({
                "dn": _safe_str(entry.distinguishedName.value),
                "name": _safe_str(entry.name.value) if hasattr(entry, 'name') else "",
                "object_type": "Trust",
                "trust_direction": TRUST_DIR.get(td, f"Unknown({td})"),
                "trust_direction_raw": td,
                "trust_type": TRUST_TYPE.get(tt, f"Unknown({tt})"),
                "trust_attributes": ta,
                "sid_filtering_disabled": not bool(ta & 0x4),  # TRUST_ATTRIBUTE_QUARANTINED_DOMAIN
                "trust_partner": _safe_str(entry.trustPartner.value) if hasattr(entry, 'trustPartner') else "",
                "flat_name": _safe_str(entry.flatName.value) if hasattr(entry, 'flatName') else "",
            })
        logger.info(f"Enumerated {len(trusts)} trust relationships")
    except LDAPException as e:
        logger.warning(f"Trust enumeration error: {e}")
    return trusts


def enumerate_password_policies(conn: Connection, base_dn: str) -> List[Dict[str, Any]]:
    """Enumerate default domain password policy and Fine-Grained Password Policies."""
    policies = []
    # Default domain policy
    try:
        conn.search(
            search_base=base_dn,
            search_filter="(objectClass=domain)",
            search_scope=SUBTREE,
            attributes=["minPwdLength", "pwdHistoryLength", "maxPwdAge",
                        "minPwdAge", "lockoutThreshold", "lockoutDuration",
                        "lockoutObservationWindow", "pwdProperties"]
        )
        if conn.entries:
            e = conn.entries[0]
            def _int(attr): return int(attr.value) if hasattr(e, attr.key if hasattr(attr, 'key') else '') and attr.value else 0
            policies.append({
                "name": "Default Domain Policy",
                "object_type": "PasswordPolicy",
                "is_default": True,
                "min_length": int(e.minPwdLength.value) if hasattr(e, 'minPwdLength') and e.minPwdLength.value else 0,
                "history_length": int(e.pwdHistoryLength.value) if hasattr(e, 'pwdHistoryLength') and e.pwdHistoryLength.value else 0,
                "lockout_threshold": int(e.lockoutThreshold.value) if hasattr(e, 'lockoutThreshold') and e.lockoutThreshold.value else 0,
                "complexity_enabled": bool(int(e.pwdProperties.value or 0) & 1) if hasattr(e, 'pwdProperties') and e.pwdProperties.value else False,
            })
    except LDAPException as e:
        logger.warning(f"Default password policy enumeration error: {e}")
    # Fine-Grained Password Policies (FGPPs)
    try:
        conn.search(
            search_base=base_dn,
            search_filter="(objectClass=msDS-PasswordSettings)",
            search_scope=SUBTREE,
            attributes=["name", "msDS-PasswordSettingsPrecedence",
                        "msDS-MinimumPasswordLength", "msDS-PasswordHistoryLength",
                        "msDS-LockoutThreshold", "msDS-PasswordComplexityEnabled",
                        "msDS-PSOAppliesTo", "distinguishedName"]
        )
        for entry in conn.entries:
            applies_to = []
            if hasattr(entry, 'msDS-PSOAppliesTo') and entry['msDS-PSOAppliesTo'].values:
                applies_to = [_safe_str(v) for v in entry['msDS-PSOAppliesTo'].values]
            policies.append({
                "name": _safe_str(entry.name.value) if hasattr(entry, 'name') else "FGPP",
                "dn": _safe_str(entry.distinguishedName.value),
                "object_type": "PasswordPolicy",
                "is_default": False,
                "min_length": int(entry['msDS-MinimumPasswordLength'].value) if hasattr(entry, 'msDS-MinimumPasswordLength') and entry['msDS-MinimumPasswordLength'].value else 0,
                "history_length": int(entry['msDS-PasswordHistoryLength'].value) if hasattr(entry, 'msDS-PasswordHistoryLength') and entry['msDS-PasswordHistoryLength'].value else 0,
                "lockout_threshold": int(entry['msDS-LockoutThreshold'].value) if hasattr(entry, 'msDS-LockoutThreshold') and entry['msDS-LockoutThreshold'].value else 0,
                "complexity_enabled": bool(entry['msDS-PasswordComplexityEnabled'].value) if hasattr(entry, 'msDS-PasswordComplexityEnabled') and entry['msDS-PasswordComplexityEnabled'].value else False,
                "applies_to": applies_to,
                "precedence": int(entry['msDS-PasswordSettingsPrecedence'].value) if hasattr(entry, 'msDS-PasswordSettingsPrecedence') and entry['msDS-PasswordSettingsPrecedence'].value else 0,
            })
        logger.info(f"Enumerated {len(policies)} password policies")
    except LDAPException as e:
        logger.warning(f"FGPP enumeration error: {e}")
    return policies


def enumerate_acls(conn: Connection, base_dn: str, objects: List[Dict]) -> List[Dict[str, Any]]:
    """
    Enumerate ACL permissions on AD objects.
    Detects GenericAll, WriteDACL, WriteOwner, GenericWrite permissions.
    """
    acls = []
    try:
        # Search for objects with security descriptors
        conn.search(
            search_base=base_dn,
            search_filter="(|(objectClass=user)(objectClass=group)(objectClass=computer))",
            search_scope=SUBTREE,
            attributes=["distinguishedName", "sAMAccountName", "objectSid", "nTSecurityDescriptor"],
            controls=[("1.2.840.113556.1.4.801", True, b"\x30\x03\x02\x01\x04")]  # DACL control
        )

        for entry in conn.entries:
            target_dn = _safe_str(entry.distinguishedName.value)
            target_name = _safe_str(entry.sAMAccountName.value) if hasattr(entry, 'sAMAccountName') else target_dn

            if hasattr(entry, 'nTSecurityDescriptor') and entry.nTSecurityDescriptor.value:
                try:
                    sd = entry.nTSecurityDescriptor.value
                    if hasattr(sd, 'dacl') and sd.dacl:
                        for ace in sd.dacl.aces:
                            _parse_ace(ace, target_dn, target_name, acls)
                except Exception as e:
                    logger.debug(f"Could not parse ACL for {target_dn}: {e}")

    except LDAPException as e:
        logger.warning(f"ACL enumeration error (may need elevated rights): {e}")
        # Fall back to inferring ACLs from membership
        acls.extend(_infer_acls_from_membership(objects))

    if not acls:
        # Infer ACLs from membership data if direct ACL read fails
        acls.extend(_infer_acls_from_membership(objects))

    logger.info(f"Found {len(acls)} ACL entries")
    return acls


def _parse_ace(ace, target_dn: str, target_name: str, acls: list):
    """Parse an ACE and add dangerous permissions to the acls list."""
    try:
        ace_type = getattr(ace, 'ace_type', None)
        if ace_type and 'DENIED' in str(ace_type).upper():
            return

        access_mask = getattr(ace, 'access_mask', None)
        if not access_mask:
            return

        mask_val = int(str(access_mask))
        trustee = getattr(ace, 'trustee', None)

        # Detect dangerous permissions
        if mask_val & 0xF01FF == 0xF01FF or mask_val == 0xF01FF:  # GenericAll
            perm = "GenericAll"
        elif mask_val & 0x40000 == 0x40000:  # WriteDACL
            perm = "WriteDACL"
        elif mask_val & 0x80000 == 0x80000:  # WriteOwner
            perm = "WriteOwner"
        elif mask_val & 0x20 == 0x20:  # GenericWrite (WriteProperty on all properties)
            perm = "GenericWrite"
        else:
            return

        if trustee:
            trustee_str = str(trustee)
            acls.append({
                "source": trustee_str,
                "target": target_dn,
                "target_name": target_name,
                "permission": perm,
                "source_type": "Unknown",
                "target_type": "Unknown"
            })
    except Exception:
        pass


def _infer_acls_from_membership(objects: List[Dict]) -> List[Dict]:
    """Infer ACL relationships from group memberships when direct ACL read is unavailable."""
    acls = []
    # Build a DN -> object map
    dn_map = {}
    for obj in objects:
        if 'dn' in obj:
            dn_map[obj['dn'].upper()] = obj

    for obj in objects:
        # If user/computer is member of a group, infer membership relationship
        for member_of_dn in obj.get('member_of', []):
            target = dn_map.get(member_of_dn.upper())
            if target:
                acls.append({
                    "source": obj['dn'],
                    "target": member_of_dn,
                    "target_name": target.get('sam_account_name', member_of_dn),
                    "permission": "MemberOf",
                    "source_type": obj.get('object_type', 'Unknown'),
                    "target_type": target.get('object_type', 'Group')
                })
    return acls


def run_full_enumeration(conn: Connection, base_dn: str) -> Dict[str, Any]:
    """Run complete AD enumeration and return all objects."""
    logger.info(f"Starting full enumeration of {base_dn}")

    users = enumerate_users(conn, base_dn)
    groups = enumerate_groups(conn, base_dn)
    computers = enumerate_computers(conn, base_dn)

    all_objects = users + groups + computers
    acls = enumerate_acls(conn, base_dn, all_objects)

    # Phase 1: additional enumerations
    gpos = enumerate_gpos(conn, base_dn)
    ous = enumerate_ous(conn, base_dn)
    trusts = enumerate_trusts(conn, base_dn)
    password_policies = enumerate_password_policies(conn, base_dn)

    return {
        "users": users,
        "groups": groups,
        "computers": computers,
        "acls": acls,
        "gpos": gpos,
        "ous": ous,
        "trusts": trusts,
        "password_policies": password_policies,
        "base_dn": base_dn
    }
