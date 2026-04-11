"""
BloodHound Data Import/Export — Feature 4.
Export session data to BloodHound-compatible JSON format.
Import SharpHound JSON collection data.
"""
import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# BloodHound JSON format version
BH_VERSION = 5


def export_bloodhound(session_data: Dict[str, Any]) -> Dict:
    """Export session data to BloodHound-compatible JSON format."""
    users = session_data.get("users", [])
    groups = session_data.get("groups", [])
    computers = session_data.get("computers", [])
    domain = session_data.get("summary", {}).get("domain", "UNKNOWN")

    bh_users = []
    for u in users:
        sam = u.get("sam_account_name", "")
        attrs = u.get("attributes", {})
        bh_users.append({
            "ObjectIdentifier": u.get("sid", ""),
            "Properties": {
                "name": f"{sam}@{domain}".upper(),
                "domain": domain.upper(),
                "samaccountname": sam,
                "displayname": u.get("display_name", sam),
                "description": u.get("description", ""),
                "enabled": not attrs.get("is_disabled", False),
                "admincount": attrs.get("is_admin", False),
                "hasspn": attrs.get("has_spn", False),
                "dontreqpreauth": attrs.get("is_asrep_roastable", False),
                "pwdneverexpires": attrs.get("is_password_never_expires", False),
            },
            "MemberOf": [{"ObjectIdentifier": dn} for dn in u.get("member_of", [])],
            "Aces": [],
        })

    bh_groups = []
    for g in groups:
        sam = g.get("sam_account_name", "")
        bh_groups.append({
            "ObjectIdentifier": g.get("sid", ""),
            "Properties": {
                "name": f"{sam}@{domain}".upper(),
                "domain": domain.upper(),
                "samaccountname": sam,
                "description": g.get("description", ""),
                "admincount": g.get("attributes", {}).get("is_admin", False),
            },
            "Members": [{"ObjectIdentifier": dn, "ObjectType": "User"} for dn in g.get("members", [])],
            "Aces": [],
        })

    bh_computers = []
    for c in computers:
        sam = c.get("sam_account_name", "")
        attrs = c.get("attributes", {})
        bh_computers.append({
            "ObjectIdentifier": c.get("sid", ""),
            "Properties": {
                "name": f"{sam}.{domain}".upper(),
                "domain": domain.upper(),
                "samaccountname": sam,
                "operatingsystem": attrs.get("os", ""),
                "enabled": True,
                "haslaps": False,
                "unconstraineddelegation": attrs.get("is_trusted_for_delegation", False),
                "allowedtodelegate": attrs.get("allowed_to_delegate_to", []),
            },
            "MemberOf": [{"ObjectIdentifier": dn} for dn in c.get("member_of", [])],
            "Aces": [],
        })

    return {
        "meta": {
            "methods": 0,
            "type": "sessions",
            "count": len(bh_users) + len(bh_groups) + len(bh_computers),
            "version": BH_VERSION,
        },
        "data": {
            "users": bh_users,
            "groups": bh_groups,
            "computers": bh_computers,
        }
    }


def import_bloodhound(bh_data: Dict) -> Dict[str, Any]:
    """Import BloodHound/SharpHound JSON and convert to internal format."""
    data = bh_data.get("data", bh_data)  # Handle both wrapped and raw formats

    users_raw = data.get("users", [])
    groups_raw = data.get("groups", [])
    computers_raw = data.get("computers", [])

    users = []
    for u in users_raw:
        props = u.get("Properties", u.get("properties", {}))
        users.append({
            "dn": u.get("ObjectIdentifier", props.get("distinguishedname", "")),
            "sam_account_name": props.get("samaccountname", props.get("name", "").split("@")[0]),
            "display_name": props.get("displayname", ""),
            "description": props.get("description", ""),
            "object_type": "User",
            "sid": u.get("ObjectIdentifier", ""),
            "member_of": [m.get("ObjectIdentifier", m) if isinstance(m, dict) else m
                          for m in u.get("MemberOf", [])],
            "members": [],
            "attributes": {
                "is_disabled": not props.get("enabled", True),
                "is_admin": props.get("admincount", False),
                "has_spn": props.get("hasspn", False),
                "is_asrep_roastable": props.get("dontreqpreauth", False),
                "is_password_never_expires": props.get("pwdneverexpires", False),
            }
        })

    groups = []
    for g in groups_raw:
        props = g.get("Properties", g.get("properties", {}))
        groups.append({
            "dn": g.get("ObjectIdentifier", props.get("distinguishedname", "")),
            "sam_account_name": props.get("samaccountname", props.get("name", "").split("@")[0]),
            "display_name": props.get("name", ""),
            "description": props.get("description", ""),
            "object_type": "Group",
            "sid": g.get("ObjectIdentifier", ""),
            "members": [m.get("ObjectIdentifier", m) if isinstance(m, dict) else m
                        for m in g.get("Members", [])],
            "member_of": [],
            "attributes": {
                "is_admin": props.get("admincount", False),
            }
        })

    computers = []
    for c in computers_raw:
        props = c.get("Properties", c.get("properties", {}))
        computers.append({
            "dn": c.get("ObjectIdentifier", props.get("distinguishedname", "")),
            "sam_account_name": props.get("samaccountname", props.get("name", "").split(".")[0]),
            "display_name": props.get("name", ""),
            "description": props.get("description", ""),
            "object_type": "Computer",
            "sid": c.get("ObjectIdentifier", ""),
            "member_of": [m.get("ObjectIdentifier", m) if isinstance(m, dict) else m
                          for m in c.get("MemberOf", [])],
            "members": [],
            "attributes": {
                "operatingSystem": props.get("operatingsystem", ""),
                "is_trusted_for_delegation": props.get("unconstraineddelegation", False),
                "allowed_to_delegate_to": props.get("allowedtodelegate", []),
                "userAccountControl": "0",
            }
        })

    logger.info(f"Imported BloodHound data: {len(users)} users, {len(groups)} groups, {len(computers)} computers")
    return {
        "users": users,
        "groups": groups,
        "computers": computers,
        "acls": [],
        "gpos": [],
        "ous": [],
        "trusts": [],
        "password_policies": [],
    }
