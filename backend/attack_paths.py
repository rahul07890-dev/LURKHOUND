"""
Attack Path Discovery Engine — Enhanced
Detects multi-hop and specific attack scenarios:
  • Kerberoastable → Credential theft → Admin
  • Low-priv user → Group membership → Domain Admin
  • AdminTo → Domain Controller (DCSync / lateral movement)
  • GenericAll / WriteDACL / WriteOwner ACL abuse chains
  • Unconstrained delegation → credential capture
  • Password-never-expires privileged accounts
"""
import logging
import networkx as nx
from typing import List, Dict, Any, Optional
from mitre_mapping import (
    get_techniques_for_path,
    get_techniques_for_finding,
    MITRE_TECHNIQUES,
)

logger = logging.getLogger(__name__)

MAX_PATH_DEPTH = 6      # Max hops in BFS/DFS traversal
MAX_PATHS_PER_PAIR = 1  # Only keep the shortest path per source→target pair

ESCALATION_EDGE_TYPES = {
    "MemberOf", "AdminTo", "GenericAll", "GenericWrite",
    "WriteDACL", "WriteOwner", "HasPermission", "ForceChangePassword",
}

SEVERITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sam(G: nx.DiGraph, node_id: str) -> str:
    return G.nodes.get(node_id, {}).get("sam", node_id.split(",")[0])


def _type(G: nx.DiGraph, node_id: str) -> str:
    return G.nodes.get(node_id, {}).get("object_type", "Unknown")


def _path_to_edges(G: nx.DiGraph, path: List[str]) -> List[Dict[str, str]]:
    """Convert a path (list of node IDs) to edge dicts."""
    edges = []
    for i in range(len(path) - 1):
        src, tgt = path[i], path[i + 1]
        edata = G.edges[src, tgt] if G.has_edge(src, tgt) else {}
        edges.append({
            "from":      _sam(G, src),
            "from_type": _type(G, src),
            "to":        _sam(G, tgt),
            "to_type":   _type(G, tgt),
            "type":      edata.get("edge_type", "Unknown"),
            "label":     edata.get("label", ""),
        })
    return edges


def _format_chain(edges: List[Dict]) -> str:
    if not edges:
        return ""
    parts = [edges[0]["from"]]
    for e in edges:
        parts += [f"→[{e['type']}]→", e["to"]]
    return " ".join(parts)


def _path_severity(edges: List[Dict], target_is_dc: bool = False, target_is_hvt: bool = False) -> str:
    dangerous = {"GenericAll", "WriteDACL", "WriteOwner"}
    has_dangerous = any(e.get("type") in dangerous for e in edges)
    has_adminto   = any(e.get("type") == "AdminTo" for e in edges)

    if target_is_dc and (has_adminto or has_dangerous):
        return "Critical"
    if target_is_hvt and (has_adminto or has_dangerous):
        return "Critical"
    if has_dangerous and len(edges) <= 2:
        return "Critical"
    if has_dangerous or (has_adminto and len(edges) <= 3):
        return "High"
    if len(edges) <= 4:
        return "High"
    return "Medium"


def _bfs(G: nx.DiGraph, src: str, tgt: str) -> Optional[List[str]]:
    try:
        return nx.shortest_path(G, source=src, target=tgt)
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None


def _make_path(G: nx.DiGraph, path_nodes: List[str], path_type: str, description: str, target_type: Optional[str] = None, extra_techniques: Optional[List[str]] = None) -> Dict[str, Any]:
    edges     = _path_to_edges(G, path_nodes)
    tgt_data  = G.nodes.get(path_nodes[-1], {})
    is_dc     = tgt_data.get("is_domain_controller", False) or tgt_data.get("is_hvt", False)
    is_hvt    = tgt_data.get("is_hvt", False)
    severity  = _path_severity(edges, target_is_dc=is_dc, target_is_hvt=is_hvt)
    techniques = get_techniques_for_path(edges, path_type=path_type, extra=extra_techniques or [])

    return {
        "path":      [_sam(G, n) for n in path_nodes],
        "path_dns":  path_nodes,
        "edges":     edges,
        "chain":     _format_chain(edges),
        "severity":  severity,
        "description": description,
        "mitre_techniques": techniques,
        "length":    len(path_nodes) - 1,
        "source":    _sam(G, path_nodes[0]),
        "target":    _sam(G, path_nodes[-1]),
        "target_type": target_type or _type(G, path_nodes[-1]),
        "path_type": path_type,
    }


# ── Path detectors ────────────────────────────────────────────────────────────

def detect_lateral_movement(G: nx.DiGraph) -> List[Dict]:
    """AdminTo paths: user/group → computer. Separate technique tags per target type."""
    paths = []
    for src, tgt, data in G.edges(data=True):
        if data.get("edge_type") != "AdminTo":
            continue
        src_data = G.nodes.get(src, {})
        tgt_data = G.nodes.get(tgt, {})
        src_sam  = src_data.get("sam", src)
        tgt_sam  = tgt_data.get("sam", tgt)
        is_dc    = tgt_data.get("is_domain_controller", False)

        if is_dc:
            path_type   = "admin_to_dc"
            description = (
                f"{src_sam} has local admin rights on Domain Controller {tgt_sam}. "
                f"This allows credential dumping (DCSync), NTDS.dit extraction, and full domain compromise."
            )
        else:
            path_type   = "admin_to_workstation"
            description = (
                f"{src_sam} has local admin rights on {tgt_sam} via SMB/WinRM. "
                f"Enables lateral movement, credential harvesting, and further pivoting."
            )

        extra = ["T1003.006"] if is_dc else ["T1550.002"]
        edge_info = {
            "from": src_sam, "from_type": src_data.get("object_type", "Unknown"),
            "to":   tgt_sam, "to_type":   tgt_data.get("object_type", "Computer"),
            "type": "AdminTo", "label": "AdminTo",
        }
        techniques = get_techniques_for_path([edge_info], path_type=path_type, extra=extra)
        severity   = "Critical" if is_dc else "High"
        paths.append({
            "path":      [src_sam, tgt_sam],
            "path_dns":  [src, tgt],
            "edges":     [edge_info],
            "chain":     _format_chain([edge_info]),
            "severity":  severity,
            "description": description,
            "mitre_techniques": techniques,
            "length":    1,
            "source":    src_sam,
            "target":    tgt_sam,
            "target_type": tgt_data.get("object_type", "Computer"),
            "path_type": path_type,
        })
    return paths


def detect_kerberoast_to_admin_paths(G: nx.DiGraph) -> List[Dict]:
    """
    Kerberoastable account → has SPN → can be cracked offline
    → if the account is admin / member of DA → full escalation path.
    """
    paths = []
    for n, data in G.nodes(data=True):
        if not data.get("has_spn"):
            continue
        if data.get("object_type") != "User":
            continue
        sam = data.get("sam", n)

        # Find any DA group reachable from this node
        for tgt_n, tgt_data in G.nodes(data=True):
            tgt_sam = tgt_data.get("sam", tgt_n)
            is_da_group = (
                "domain admins" in tgt_sam.lower()
                or "enterprise admins" in tgt_sam.lower()
                or tgt_data.get("is_hvt", False)
            )
            if not is_da_group or tgt_n == n:
                continue

            path = _bfs(G, n, tgt_n)
            if not path or len(path) < 2:
                continue

            edges = _path_to_edges(G, path)
            # Prepend a "virtual" Kerberoast step in the description
            techniques = get_techniques_for_path(edges, path_type="kerberoast_escalation",
                                                  extra=["T1558.003"])
            tgt_data_final = G.nodes.get(tgt_n, {})

            severity = "Critical" if tgt_data_final.get("is_hvt") or "domain admins" in tgt_sam.lower() else "High"
            spn_list  = data.get('spn_list') or []
            spn_label = spn_list[0] if spn_list else 'SPN'
            description = (
                f"{sam} is Kerberoastable (has SPN: {spn_label}). "
                f"Crack the TGS ticket offline → compromise {sam} → escalate to {tgt_sam} "
                f"via {edges[0]['type'] if edges else 'membership'}."
            )
            paths.append({
                "path":      [_sam(G, nd) for nd in path],
                "path_dns":  path,
                "edges":     edges,
                "chain":     f"[Kerberoast] {sam} → " + _format_chain(edges),
                "severity":  severity,
                "description": description,
                "mitre_techniques": techniques,
                "length":    len(path),           # +1 to reflect the kerberoast step
                "source":    sam,
                "target":    tgt_sam,
                "target_type": tgt_data_final.get("object_type", "Group"),
                "path_type": "kerberoast_escalation",
            })
    return paths


def detect_acl_abuse_paths(G: nx.DiGraph) -> List[Dict]:
    """GenericAll / WriteDACL / WriteOwner / GenericWrite — direct ACL abuse."""
    abuse_paths = []
    ACL_TYPES = {
        "GenericAll":   ("generic_all_abuse",   "Full control over {tgt} — reset password, modify group membership, write any attribute."),
        "WriteDACL":    ("write_dacl_abuse",     "Modify the DACL of {tgt} to grant arbitrary permissions, including GenericAll."),
        "WriteOwner":   ("write_owner_abuse",    "Take ownership of {tgt}, then grant self GenericAll to fully compromise the object."),
        "GenericWrite": ("generic_write_abuse",  "Write any non-protected attribute on {tgt} — modify SPN (targeted Kerberoasting) or other attributes."),
    }
    for src, tgt, data in G.edges(data=True):
        edge_type = data.get("edge_type", "")
        if edge_type not in ACL_TYPES:
            continue
        src_data  = G.nodes.get(src, {})
        tgt_data  = G.nodes.get(tgt, {})
        src_sam   = src_data.get("sam", src)
        tgt_sam   = tgt_data.get("sam", tgt)
        path_type, desc_tmpl = ACL_TYPES[edge_type]
        description = (
            f"{src_sam} has {edge_type} permission on {tgt_sam}. "
            + desc_tmpl.format(tgt=tgt_sam)
        )
        is_privileged = (
            tgt_data.get("is_hvt", False) or tgt_data.get("is_admin", False)
            or tgt_data.get("is_privileged", False)
        )
        edge_info = {
            "from": src_sam, "from_type": src_data.get("object_type", "Unknown"),
            "to":   tgt_sam, "to_type":   tgt_data.get("object_type", "Unknown"),
            "type": edge_type, "label": edge_type,
        }
        techniques = get_techniques_for_path([edge_info], path_type=path_type)
        abuse_paths.append({
            "path":      [src_sam, tgt_sam],
            "path_dns":  [src, tgt],
            "edges":     [edge_info],
            "chain":     _format_chain([edge_info]),
            "severity":  "Critical" if is_privileged else "High",
            "description": description,
            "mitre_techniques": techniques,
            "length":    1,
            "source":    src_sam,
            "target":    tgt_sam,
            "target_type": tgt_data.get("object_type", "Unknown"),
            "path_type": path_type,
        })
    return abuse_paths


def detect_domain_admin_paths(G: nx.DiGraph) -> List[Dict]:
    """Low-priv user → (multi-hop via groups) → Domain Admin group."""
    paths = []
    da_nodes = [
        n for n, d in G.nodes(data=True)
        if "domain admins" in d.get("sam", "").lower()
        or "enterprise admins" in d.get("sam", "").lower()
    ]
    if not da_nodes:
        return []

    # Start from non-admin users only
    user_nodes = [
        n for n, d in G.nodes(data=True)
        if d.get("object_type") == "User"
        and not d.get("is_admin", False)
        and not d.get("is_disabled", False)
    ]

    seen = set()
    for user in user_nodes:
        for da in da_nodes:
            path = _bfs(G, user, da)
            if not path or len(path) < 2:
                continue
            key = tuple(path)
            if key in seen:
                continue
            seen.add(key)

            edges      = _path_to_edges(G, path)
            edge_types = [e["type"] for e in edges]
            user_data  = G.nodes.get(user, {})
            da_data    = G.nodes.get(da, {})
            user_sam   = user_data.get("sam", user)
            da_sam     = da_data.get("sam", da)

            # Rich description based on path composition
            if all(t == "MemberOf" for t in edge_types):
                description = (
                    f"{user_sam} is transitively a member of {da_sam} "
                    f"through {len(path)-2} intermediate group(s): "
                    f"{' → '.join(_sam(G, n) for n in path[1:-1])}. "
                    f"This grants full Domain Admin privileges."
                )
                path_type = "nested_group_da_escalation"
            else:
                description = (
                    f"{user_sam} can escalate to {da_sam} via a "
                    f"{len(edges)}-step path involving: "
                    f"{', '.join(set(edge_types))}."
                )
                path_type = "user_to_domain_admin"

            techniques = get_techniques_for_path(edges, path_type=path_type, extra=["T1078.002"])
            paths.append({
                "path":      [_sam(G, n) for n in path],
                "path_dns":  path,
                "edges":     edges,
                "chain":     _format_chain(edges),
                "severity":  "Critical",
                "description": description,
                "mitre_techniques": techniques,
                "length":    len(path) - 1,
                "source":    user_sam,
                "target":    da_sam,
                "target_type": "Group",
                "path_type": path_type,
            })
    return paths


def detect_dcsync_risk(G: nx.DiGraph) -> List[Dict]:
    """
    Accounts that can reach a DC via AdminTo can perform DCSync (T1003.006).
    Detect: any principal with AdminTo on a DC + GenericAll/WriteDACL on domain root.
    """
    paths = []
    dc_nodes = [n for n, d in G.nodes(data=True) if d.get("is_domain_controller")]
    if not dc_nodes:
        return []

    for src, tgt, data in G.edges(data=True):
        if data.get("edge_type") != "AdminTo":
            continue
        if tgt not in dc_nodes:
            continue
        src_data = G.nodes.get(src, {})
        tgt_data = G.nodes.get(tgt, {})
        src_sam  = src_data.get("sam", src)
        tgt_sam  = tgt_data.get("sam", tgt)

        edge_info = {
            "from": src_sam, "from_type": src_data.get("object_type", "Unknown"),
            "to":   tgt_sam, "to_type":   "Computer",
            "type": "AdminTo", "label": "AdminTo",
        }
        techniques = get_techniques_for_path([edge_info], path_type="dcsync_risk",
                                              extra=["T1003.006", "T1003"])
        paths.append({
            "path":      [src_sam, tgt_sam],
            "path_dns":  [src, tgt],
            "edges":     [edge_info],
            "chain":     f"{src_sam} →[AdminTo→DCSync]→ {tgt_sam}",
            "severity":  "Critical",
            "description": (
                f"{src_sam} has administrative access to Domain Controller {tgt_sam}. "
                f"An attacker can run DCSync (mimikatz lsadump::dcsync) to replicate all "
                f"password hashes from the domain, including the krbtgt hash for Golden Ticket attacks."
            ),
            "mitre_techniques": techniques,
            "length":    1,
            "source":    src_sam,
            "target":    tgt_sam,
            "target_type": "Computer",
            "path_type": "dcsync_risk",
        })
    return paths


def detect_unconstrained_delegation(G: nx.DiGraph) -> List[Dict]:
    """Computers with unconstrained delegation = credential capture risk."""
    paths = []
    for n, data in G.nodes(data=True):
        if data.get("object_type") != "Computer":
            continue
        try:
            raw_uac = (
                data.get("userAccountControl")
                or data.get("attributes", {}).get("userAccountControl")
                or 0
            )
            uac = int(raw_uac)
        except (ValueError, TypeError):
            uac = 0
        trusted_for_delegation = bool(uac & 0x80000) or data.get("is_trusted_for_delegation", False)
        if not trusted_for_delegation:
            continue
        sam = data.get("sam", n)
        techniques = get_techniques_for_finding("unconstrained_delegation") or \
                     [MITRE_TECHNIQUES.get("T1558"), MITRE_TECHNIQUES.get("T1207")]
        techniques = [t for t in techniques if t]
        paths.append({
            "path":      [sam],
            "path_dns":  [n],
            "edges":     [],
            "chain":     f"[Unconstrained Delegation] → {sam}",
            "severity":  "High",
            "description": (
                f"{sam} has Unconstrained Delegation enabled. Any user that authenticates to a "
                f"service on {sam} will have their TGT cached in memory. An attacker with local "
                f"admin access can extract all cached TGTs (including DCs) using Rubeus."
            ),
            "mitre_techniques": techniques,
            "length":    0,
            "source":    sam,
            "target":    sam,
            "target_type": "Computer",
            "path_type": "unconstrained_delegation",
        })
    return paths


def detect_password_never_expires_admin(G: nx.DiGraph) -> List[Dict]:
    """Privileged accounts with password-never-expires = long-term credential risk."""
    paths = []
    for n, data in G.nodes(data=True):
        if data.get("object_type") != "User":
            continue
        if not (data.get("is_admin") or data.get("is_hvt")):
            continue
        if not data.get("is_password_never_expires"):
            continue
        if data.get("is_disabled"):
            continue
        sam = data.get("sam", n)
        edge_info = {
            "from": sam, "from_type": "User",
            "to":   sam, "to_type":   "User",
            "type": "StaleCredential", "label": "PasswordNeverExpires",
        }
        techniques = get_techniques_for_path([edge_info], path_type="stale_privileged_credential",
                                              extra=["T1078.002", "T1110"])
        paths.append({
            "path":      [sam],
            "path_dns":  [n],
            "edges":     [],
            "chain":     f"[Stale Credentials] {sam} → Password Never Expires",
            "severity":  "High",
            "description": (
                f"Privileged account {sam} has 'Password Never Expires' set. "
                f"If credentials are stolen (phishing, pass-the-hash, Kerberoasting), "
                f"they remain valid indefinitely with no forced rotation."
            ),
            "mitre_techniques": techniques,
            "length":    0,
            "source":    sam,
            "target":    sam,
            "target_type": "User",
            "path_type": "stale_privileged_credential",
        })
    return paths


def detect_constrained_delegation(G: nx.DiGraph) -> List[Dict]:
    """Computers with constrained delegation — can impersonate users to specific services."""
    paths = []
    for n, data in G.nodes(data=True):
        if data.get('object_type') != 'Computer':
            continue
        targets = data.get('allowed_to_delegate_to') or []
        if not targets:
            continue
        sam = data.get('sam', n)
        target_str = ', '.join(targets[:3]) + ('...' if len(targets) > 3 else '')
        techniques = get_techniques_for_path([], path_type='constrained_delegation',
                                              extra=['T1550.003'])
        paths.append({
            "path":      [sam],
            "path_dns":  [n],
            "edges":     [],
            "chain":     f"[Constrained Delegation] {sam} → {target_str}",
            "severity":  "High",
            "description": (
                f"{sam} has Constrained Delegation configured to: {target_str}. "
                f"An attacker with local admin on {sam} can impersonate any user (including Domain Admins) "
                f"to the listed services using S4U2Proxy."
            ),
            "mitre_techniques": techniques,
            "length":    0,
            "source":    sam,
            "target":    sam,
            "target_type": "Computer",
            "path_type": "constrained_delegation",
        })
    return paths


def detect_rbcd(G: nx.DiGraph) -> List[Dict]:
    """Computers with Resource-Based Constrained Delegation configured."""
    paths = []
    for n, data in G.nodes(data=True):
        if data.get('object_type') != 'Computer':
            continue
        if not data.get('has_rbcd', False):
            continue
        sam = data.get('sam', n)
        techniques = get_techniques_for_path([], path_type='rbcd_abuse',
                                              extra=['T1550.003', 'T1187'])
        paths.append({
            "path":      [sam],
            "path_dns":  [n],
            "edges":     [],
            "chain":     f"[RBCD] → {sam}",
            "severity":  "High",
            "description": (
                f"{sam} has Resource-Based Constrained Delegation (msDS-AllowedToActOnBehalfOfOtherIdentity) set. "
                f"If an attacker controls any principal listed in the RBCD ACL, they can impersonate "
                f"any user to services on {sam} — including Domain Admins."
            ),
            "mitre_techniques": techniques,
            "length":    0,
            "source":    sam,
            "target":    sam,
            "target_type": "Computer",
            "path_type": "rbcd_abuse",
        })
    return paths


def detect_gpo_abuse(G: nx.DiGraph, gpos: List[Dict] = None, ous: List[Dict] = None) -> List[Dict]:
    """Detect principals who can modify GPOs linked to OUs containing privileged objects."""
    paths = []
    if not gpos or not ous:
        return paths
    # Build OU→GPO linkage map
    gpo_ou_map = {}  # GPO DN → list of OU names
    for ou in ous:
        for link in ou.get('linked_gpos', []):
            gpo_dn = link.get('dn', '').upper()
            if gpo_dn not in gpo_ou_map:
                gpo_ou_map[gpo_dn] = []
            gpo_ou_map[gpo_dn].append(ou.get('name', ou['dn']))

    # Check if any principal has write access to a GPO
    for gpo in gpos:
        gpo_dn = gpo.get('dn', '').upper()
        gpo_name = gpo.get('display_name', gpo_dn)
        linked_ous = gpo_ou_map.get(gpo_dn, [])
        if not linked_ous:
            continue

        # Check edges targeting this GPO
        for src, tgt, data in G.edges(data=True):
            if tgt.upper() != gpo_dn:
                continue
            edge_type = data.get('edge_type', '')
            if edge_type not in ('GenericAll', 'GenericWrite', 'WriteDACL', 'WriteOwner'):
                continue
            src_data = G.nodes.get(src, {})
            src_sam = src_data.get('sam', src)
            techniques = get_techniques_for_path([], path_type='gpo_abuse',
                                                  extra=['T1484.001'])
            paths.append({
                "path":      [src_sam, gpo_name],
                "path_dns":  [src, gpo_dn],
                "edges":     [{
                    "from": src_sam, "from_type": src_data.get('object_type', 'Unknown'),
                    "to": gpo_name, "to_type": "GPO",
                    "type": edge_type, "label": edge_type,
                }],
                "chain":     f"{src_sam} →[{edge_type}]→ GPO:{gpo_name} →[Linked]→ {', '.join(linked_ous)}",
                "severity":  "Critical",
                "description": (
                    f"{src_sam} has {edge_type} on GPO '{gpo_name}' which is linked to OU(s): "
                    f"{', '.join(linked_ous)}. Modifying this GPO allows deploying malicious logon scripts, "
                    f"scheduled tasks, or software to all objects in these OUs."
                ),
                "mitre_techniques": techniques,
                "length":    1,
                "source":    src_sam,
                "target":    gpo_name,
                "target_type": "GPO",
                "path_type": "gpo_abuse",
            })
    return paths



# ── Main entry ────────────────────────────────────────────────────────────────

def run_full_discovery(G: nx.DiGraph, _hvt_nodes: List[str],
                      gpos: Optional[List[Dict]] = None, ous: Optional[List[Dict]] = None) -> List[Dict]:
    """Run all path discovery modules and return deduplicated, sorted results."""
    all_paths: List[Dict] = []
    seen_chains: set[str] = set()

    def add_paths(detector_name: str, paths: List[Dict]):
        for p in paths:
            chain = p.get("chain", "")
            if chain and chain not in seen_chains:
                seen_chains.add(chain)
                all_paths.append(p)

    DETECTORS = [
        ("dcsync_risk",               detect_dcsync_risk),
        ("acl_abuse_paths",            detect_acl_abuse_paths),
        ("kerberoast_paths",           detect_kerberoast_to_admin_paths),
        ("domain_admin_paths",         detect_domain_admin_paths),
        ("unconstrained_delegation",   detect_unconstrained_delegation),
        ("password_never_expires",     detect_password_never_expires_admin),
        ("lateral_movement",           detect_lateral_movement),
        ("constrained_delegation",     detect_constrained_delegation),
        ("rbcd",                       detect_rbcd),
    ]

    for name, detector in DETECTORS:
        try:
            results = detector(G)
            add_paths(name, results)
            logger.debug(f"[{name}] found {len(results)} paths")
        except Exception as exc:
            logger.error(f"[attack_paths] detector '{name}' failed: {exc}", exc_info=True)

    # GPO abuse needs extra data
    try:
        gpo_results = detect_gpo_abuse(G, gpos=gpos, ous=ous)
        add_paths("gpo_abuse", gpo_results)
        logger.debug(f"[gpo_abuse] found {len(gpo_results)} paths")
    except Exception as exc:
        logger.error(f"[attack_paths] detector 'gpo_abuse' failed: {exc}", exc_info=True)

    all_paths.sort(key=lambda p: (SEVERITY_ORDER.get(p["severity"], 4), p["length"]))
    logger.info(f"Total attack paths discovered: {len(all_paths)}")
    return all_paths


# ── Legacy helpers (kept for graph_builder compatibility) ─────────────────────

def find_shortest_path_bfs(G: nx.DiGraph, source: str, target: str) -> Optional[List[str]]:
    return _bfs(G, source, target)


def find_all_paths_dfs(G: nx.DiGraph, source: str, target: str, max_depth: int = MAX_PATH_DEPTH) -> List[List[str]]:
    all_p: List[List[str]] = []
    def dfs(cur: str, path: List[str], visited: set[str]) -> None:
        if len(path) > max_depth: return
        if cur == target: all_p.append(list(path)); return
        for nb in G.successors(cur):
            if nb not in visited:
                visited.add(nb); path.append(nb)
                dfs(nb, path, visited)
                path.pop(); visited.remove(nb)
    if source not in G or target not in G: return []
    dfs(source, [source], {source})
    return sorted(all_p, key=len)
