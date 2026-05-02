"""
Tests for attack path discovery engine.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import networkx as nx
from attack_paths import (
    detect_kerberoast_to_admin_paths,
    _bfs,
    _path_to_edges,
    _sam,
)


def _build_test_graph():
    """Build a minimal graph for testing."""
    G = nx.DiGraph()
    G.add_node("user_spn", sam="pparker", object_type="User", has_spn=True,
               spn_list=["MSSQLSvc/web.MARVEL.local:1433"])
    G.add_node("helpdesk", sam="HelpDesk", object_type="Group")
    G.add_node("da_group", sam="Domain Admins", object_type="Group", is_hvt=True)
    G.add_node("normal_user", sam="nromanoff", object_type="User", has_spn=False)

    G.add_edge("user_spn", "helpdesk", edge_type="MemberOf", label="MemberOf")
    G.add_edge("helpdesk", "da_group", edge_type="GenericAll", label="GenericAll")
    return G


class TestBFS:
    def test_bfs_finds_path(self):
        G = _build_test_graph()
        path = _bfs(G, "user_spn", "da_group")
        assert path is not None
        assert path[0] == "user_spn"
        assert path[-1] == "da_group"

    def test_bfs_no_path(self):
        G = _build_test_graph()
        path = _bfs(G, "normal_user", "da_group")
        assert path is None or len(path) == 0


class TestKerberoastDetector:
    def test_finds_kerberoast_path(self):
        G = _build_test_graph()
        paths = detect_kerberoast_to_admin_paths(G)
        assert len(paths) >= 1
        assert paths[0]["source"] == "pparker"
        assert paths[0]["target"] == "Domain Admins"
        assert paths[0]["severity"] == "Critical"
        assert paths[0]["path_type"] == "kerberoast_escalation"

    def test_no_spn_no_path(self):
        G = _build_test_graph()
        # Remove SPN from user
        G.nodes["user_spn"]["has_spn"] = False
        paths = detect_kerberoast_to_admin_paths(G)
        assert len(paths) == 0

    def test_no_da_target_no_path(self):
        G = nx.DiGraph()
        G.add_node("user", sam="testuser", object_type="User", has_spn=True, spn_list=["SPN"])
        G.add_node("group", sam="SomeGroup", object_type="Group")
        G.add_edge("user", "group", edge_type="MemberOf", label="MemberOf")
        paths = detect_kerberoast_to_admin_paths(G)
        assert len(paths) == 0


class TestPathToEdges:
    def test_edges_format(self):
        G = _build_test_graph()
        edges = _path_to_edges(G, ["user_spn", "helpdesk", "da_group"])
        assert len(edges) == 2
        assert edges[0]["from"] == "pparker"
        assert edges[0]["to"] == "HelpDesk"
        assert edges[0]["type"] == "MemberOf"


class TestSamHelper:
    def test_sam_returns_name(self):
        G = _build_test_graph()
        assert _sam(G, "user_spn") == "pparker"

    def test_sam_missing_node(self):
        G = _build_test_graph()
        result = _sam(G, "nonexistent")
        assert isinstance(result, str)
