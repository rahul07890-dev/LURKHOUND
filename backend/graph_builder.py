"""
Permission Graph Construction Module
Builds a NetworkX directed graph from normalized AD data.
Nodes: User, Group, Computer
Edges: MemberOf, AdminTo, HasPermission (GenericAll, WriteDACL, WriteOwner, etc.)
"""
import logging
import networkx as nx
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Privilege escalation edge weights (lower = more dangerous)
EDGE_WEIGHTS = {
    "GenericAll": 1,
    "GenericWrite": 2,
    "WriteDACL": 2,
    "WriteOwner": 2,
    "AdminTo": 2,
    "ForceChangePassword": 3,
    "MemberOf": 5,
    "HasPermission": 3,
}

# High-value target name patterns
HVT_PATTERNS = [
    "domain admins",
    "enterprise admins",
    "schema admins",
    "administrators",
    "domain controllers",
    "group policy creator owners",
]


def _get_node_id(obj: Dict) -> str:
    """Get a stable node ID from an AD object."""
    return obj.get('dn', obj.get('sam_account_name', '')).upper()


def _get_node_label(obj: Dict) -> str:
    """Get a human-readable label for a node."""
    return (obj.get('sam_account_name', '') or 
            obj.get('display_name', '') or 
            obj.get('dn', '').split(',')[0].replace('CN=', ''))


def _is_hvt(name: str) -> bool:
    """Check if a node is a High-Value Target."""
    name_lower = name.lower()
    for pattern in HVT_PATTERNS:
        if pattern in name_lower:
            return True
    return False


def build_graph(normalized_data: Dict) -> nx.DiGraph:
    """
    Build the full permission graph from normalized AD data.
    
    Returns a directed graph where:
    - Nodes represent AD objects (User, Group, Computer)
    - Edges represent relationships and permissions
    """
    G = nx.DiGraph()

    users = normalized_data.get('users', [])
    groups = normalized_data.get('groups', [])
    computers = normalized_data.get('computers', [])
    acls = normalized_data.get('acls', [])

    # Add user nodes
    for user in users:
        node_id = _get_node_id(user)
        if not node_id:
            continue
        G.add_node(node_id,
            label=_get_node_label(user),
            object_type="User",
            sam=user.get('sam_account_name', ''),
            dn=user.get('dn', ''),
            sid=user.get('sid', ''),
            is_admin=user.get('attributes', {}).get('is_admin', False),
            is_disabled=user.get('attributes', {}).get('is_disabled', False),
            is_hvt=_is_hvt(user.get('sam_account_name', '')),
            has_spn=user.get('attributes', {}).get('has_spn', False),
        )

    # Add group nodes
    for group in groups:
        node_id = _get_node_id(group)
        if not node_id:
            continue
        sam_lower = group.get('sam_account_name', '').lower()
        is_hvt = _is_hvt(sam_lower)
        G.add_node(node_id,
            label=_get_node_label(group),
            object_type="Group",
            sam=group.get('sam_account_name', ''),
            dn=group.get('dn', ''),
            sid=group.get('sid', ''),
            is_privileged=group.get('attributes', {}).get('is_privileged', False),
            is_admin=group.get('attributes', {}).get('is_admin', False),
            is_hvt=is_hvt,
        )

    # Add computer nodes
    for comp in computers:
        node_id = _get_node_id(comp)
        if not node_id:
            continue
        is_dc = comp.get('attributes', {}).get('is_domain_controller', False)
        G.add_node(node_id,
            label=_get_node_label(comp),
            object_type="Computer",
            sam=comp.get('sam_account_name', ''),
            dn=comp.get('dn', ''),
            sid=comp.get('sid', ''),
            is_domain_controller=is_dc,
            is_hvt=is_dc,
            os=comp.get('attributes', {}).get('os', ''),
            hostname=comp.get('attributes', {}).get('hostname', ''),
            is_trusted_for_delegation=comp.get('attributes', {}).get('is_trusted_for_delegation', False),
            allowed_to_delegate_to=comp.get('attributes', {}).get('allowed_to_delegate_to', []),
            has_rbcd=comp.get('attributes', {}).get('has_rbcd', False),
        )

    # Add MemberOf edges from user/computer memberOf lists
    for obj in users + computers:
        src_id = _get_node_id(obj)
        if not src_id or src_id not in G:
            continue
        for group_dn in obj.get('member_of', []):
            group_dn_upper = group_dn.upper()
            if group_dn_upper in G:
                G.add_edge(src_id, group_dn_upper,
                    edge_type="MemberOf",
                    weight=EDGE_WEIGHTS["MemberOf"],
                    label="MemberOf"
                )

    # Add MemberOf edges from group->group (nested groups) and group members
    dn_map = normalized_data.get('dn_map', {})
    for group in groups:
        src_id = _get_node_id(group)
        if not src_id or src_id not in G:
            continue

        # Group nested in another group
        for parent_dn in group.get('member_of', []):
            parent_upper = parent_dn.upper()
            if parent_upper in G:
                G.add_edge(src_id, parent_upper,
                    edge_type="MemberOf",
                    weight=EDGE_WEIGHTS["MemberOf"],
                    label="MemberOf"
                )

        # Members of this group
        for member_dn in group.get('members', []):
            member_upper = member_dn.upper()
            if member_upper in G:
                G.add_edge(member_upper, src_id,
                    edge_type="MemberOf",
                    weight=EDGE_WEIGHTS["MemberOf"],
                    label="MemberOf"
                )

    # Add AdminTo edges (computers where user is admin — inferred from Domain Admins membership)
    da_members = set()
    for group in groups:
        sam_lower = group.get('sam_account_name', '').lower()
        if 'domain admins' in sam_lower or 'administrators' in sam_lower:
            for member_dn in group.get('members', []):
                da_members.add(member_dn.upper())

    for comp in computers:
        comp_id = _get_node_id(comp)
        if not comp_id or comp_id not in G:
            continue
        for admin_dn in da_members:
            if admin_dn in G and G.nodes[admin_dn].get('object_type') in ('User', 'Group'):
                G.add_edge(admin_dn, comp_id,
                    edge_type="AdminTo",
                    weight=EDGE_WEIGHTS["AdminTo"],
                    label="AdminTo"
                )

    # Add ACL permission edges
    for acl in acls:
        src = acl.get('source', '').upper()
        tgt = acl.get('target', '').upper()
        perm = acl.get('permission', '')

        if not src or not tgt or perm == "MemberOf":
            continue

        if src not in G:
            # Add unknown source as a node
            src_name = acl.get('source_name', src.split(',')[0].replace('CN=', ''))
            G.add_node(src, label=src_name, object_type=acl.get('source_type', 'Unknown'),
                       sam=src_name, dn=src, is_hvt=False)

        if tgt not in G:
            tgt_name = acl.get('target_name', tgt.split(',')[0].replace('CN=', ''))
            G.add_node(tgt, label=tgt_name, object_type=acl.get('target_type', 'Unknown'),
                       sam=tgt_name, dn=tgt, is_hvt=False)

        weight = EDGE_WEIGHTS.get(perm, 3)
        G.add_edge(src, tgt,
            edge_type=perm,
            weight=weight,
            label=perm,
            permission=perm
        )

    logger.info(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


def get_hvt_nodes(G: nx.DiGraph) -> List[str]:
    """Return a list of High-Value Target node IDs."""
    return [n for n, data in G.nodes(data=True) if data.get('is_hvt', False)]


def get_domain_admin_group(G: nx.DiGraph) -> Optional[str]:
    """Find the Domain Admins group node."""
    for n, data in G.nodes(data=True):
        sam = data.get('sam', '').lower()
        if 'domain admins' in sam:
            return n
    return None


def get_domain_controllers(G: nx.DiGraph) -> List[str]:
    """Return node IDs for all Domain Controllers."""
    return [n for n, data in G.nodes(data=True)
            if data.get('is_domain_controller', False) or 'domain controllers' in data.get('sam', '').lower()]


def graph_to_dict(G: nx.DiGraph) -> Dict:
    """Export graph to a serializable dictionary for API responses."""
    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "label": data.get('label', node_id.split(',')[0]),
            "object_type": data.get('object_type', 'Unknown'),
            "sam": data.get('sam', ''),
            "is_hvt": data.get('is_hvt', False),
            "is_admin": data.get('is_admin', False),
            "is_domain_controller": data.get('is_domain_controller', False),
            "is_privileged": data.get('is_privileged', False),
        })

    edges = []
    for src, tgt, data in G.edges(data=True):
        edges.append({
            "source": src,
            "target": tgt,
            "type": data.get('edge_type', ''),
            "label": data.get('label', ''),
            "weight": data.get('weight', 5),
        })

    return {"nodes": nodes, "edges": edges}
