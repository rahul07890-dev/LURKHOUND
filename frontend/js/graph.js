/**
 * BloodHound-style Interactive AD Graph
 * Full graph: users, groups, computers, DCs — edges labeled by relationship type.
 * Supports click-to-inspect, filter by type, layout change, highlight, path rendering.
 */

"use strict";

// ── Constants ──────────────────────────────────────────────────
const NODE_STYLES = {
    User: { bg: "#1a2a4a", border: "#4f9cf9", text: "#4f9cf9", shape: "ellipse", size: 44 },
    Group: { bg: "#1e1535", border: "#a855f7", text: "#a855f7", shape: "round-rectangle", size: 44 },
    Computer: { bg: "#0f2a26", border: "#2dd4bf", text: "#2dd4bf", shape: "diamond", size: 50 },
    Unknown: { bg: "#1a1a2e", border: "#8896b3", text: "#8896b3", shape: "ellipse", size: 38 },
};

const EDGE_PALETTE = {
    MemberOf: "#4f9cf9",
    AdminTo: "#f87171",
    GenericAll: "#ef4444",
    GenericWrite: "#fb923c",
    WriteDACL: "#fbbf24",
    WriteOwner: "#f59e0b",
    HasPermission: "#a855f7",
    default: "#8896b3",
};

const HVT_NAMES = ["domain admins", "enterprise admins", "administrators",
    "schema admins", "group policy creator owners"];

// ── State ──────────────────────────────────────────────────────
let fullCy = null;
let graphActiveFilters = { users: true, groups: true, computers: true };
let graphSelectedNode = null;

// Build element arrays from normalised AD data
function buildGraphElements(users = [], groups = [], computers = []) {
    const elements = [];

    users.forEach(u => {
        const sam = u.sam_account_name || u.display_name || "?";
        const isAdmin = !!u.attributes?.is_admin;
        const isHvt = isAdmin;
        const color = isHvt ? "#f87171" : NODE_STYLES.User.border;
        const bgColor = isHvt ? "#2a0f0f" : NODE_STYLES.User.bg;
        elements.push({
            data: {
                id: u.dn || sam, label: sam, type: "User",
                sam, group: "users", isHvt,
                isAdmin, disabled: !!u.attributes?.is_disabled,
                hasSpn: !!u.attributes?.has_spn,
                _border: color, _bg: bgColor,
                _memberOf: (u.member_of || []),
            }
        });
    });

    groups.forEach(g => {
        const sam = g.sam_account_name || "?";
        const lsam = sam.toLowerCase();
        const isHvt = HVT_NAMES.some(h => lsam.includes(h));
        const color = isHvt ? "#f87171" : NODE_STYLES.Group.border;
        const bgColor = isHvt ? "#2a0f1e" : NODE_STYLES.Group.bg;
        elements.push({
            data: {
                id: g.dn || sam, label: sam, type: "Group",
                sam, group: "groups", isHvt,
                isPrivileged: !!g.attributes?.is_privileged,
                memberCount: (g.members || []).length,
                _border: color, _bg: bgColor,
                _members: (g.members || []),
                _memberOf: (g.member_of || []),
            }
        });
    });

    computers.forEach(c => {
        const sam = c.sam_account_name || c.display_name || "?";
        const isDC = !!c.attributes?.is_domain_controller;
        const color = isDC ? "#fbbf24" : NODE_STYLES.Computer.border;
        const bgColor = isDC ? "#1a1500" : NODE_STYLES.Computer.bg;
        elements.push({
            data: {
                id: c.dn || sam, label: sam, type: "Computer",
                sam, group: "computers", isDC, isHvt: isDC,
                os: c.attributes?.os || "",
                _border: color, _bg: bgColor,
                _memberOf: (c.member_of || []),
            }
        });
    });

    // Build node lookup for edge resolution
    const idMap = new Map(elements.map(e => [e.data.id, e.data]));
    const samMap = new Map(elements.map(e => [e.data.sam?.toUpperCase(), e.data]));
    const dnMap = new Map(elements.map(e => [e.data.id?.toUpperCase(), e.data]));

    function resolveNode(ref) {
        if (!ref) return null;
        return idMap.get(ref)
            || samMap.get(ref.split(",")[0].replace(/CN=/i, "").toUpperCase())
            || dnMap.get(ref.toUpperCase())
            || null;
    }

    const edgeSet = new Set();
    function addEdge(srcId, tgtId, edgeType) {
        if (!srcId || !tgtId || srcId === tgtId) return;
        const key = `${srcId}|${tgtId}|${edgeType}`;
        if (edgeSet.has(key)) return;
        edgeSet.add(key);
        elements.push({
            data: {
                id: key, source: srcId, target: tgtId,
                label: edgeType,
                _color: EDGE_PALETTE[edgeType] || EDGE_PALETTE.default,
            }
        });
    }

    // MemberOf edges (users → groups, groups → groups)
    elements.filter(e => e.data.group && e.data._memberOf).forEach(e => {
        e.data._memberOf.forEach(parentRef => {
            const parent = resolveNode(parentRef);
            if (parent) addEdge(e.data.id, parent.id, "MemberOf");
        });
    });

    // Group → member edges (reverse for groups listing members)
    elements.filter(e => e.data.type === "Group" && e.data._members).forEach(g => {
        g.data._members.forEach(memberRef => {
            const member = resolveNode(memberRef);
            if (member) addEdge(member.id, g.data.id, "MemberOf");
        });
    });

    return elements;
}


// ── Cytoscape Graph Stylesheet ──────────────────────────────────
function buildStylesheet() {
    return [
        {
            selector: "node",
            style: {
                "background-color": "data(_bg)",
                "border-color": "data(_border)",
                "border-width": 2,
                "label": "data(label)",
                "color": "data(_border)",
                "text-valign": "bottom",
                "text-halign": "center",
                "font-size": "11px",
                "font-family": "JetBrains Mono, monospace",
                "font-weight": "600",
                "text-margin-y": 6,
                "text-wrap": "ellipsis",
                "text-max-width": "90px",
                "width": 44,
                "height": 44,
                "shape": (el) => {
                    const t = el.data("type");
                    if (t === "Group") return "round-rectangle";
                    if (t === "Computer") return "diamond";
                    return "ellipse";
                },
                "background-opacity": 1,
                "transition-property": "background-color, border-color, border-width",
                "transition-duration": "0.15s",
            },
        },
        {
            selector: "node[?isDC]",
            style: {
                "shape": "star",
                "width": 54, "height": 54,
                "border-width": 3,
            },
        },
        {
            selector: "node[?isHvt]",
            style: {
                "border-width": 3,
                "border-style": "double",
            },
        },
        {
            selector: "node[?disabled]",
            style: {
                "opacity": 0.45,
                "border-style": "dashed",
            },
        },
        {
            selector: "edge",
            style: {
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                "line-color": "data(_color)",
                "target-arrow-color": "data(_color)",
                "width": 1.5,
                "label": "data(label)",
                "font-size": "9px",
                "font-family": "JetBrains Mono, monospace",
                "color": "#94a3b8",
                "text-background-color": "#090d1a",
                "text-background-opacity": 0.8,
                "text-background-padding": "2px",
                "opacity": 0.75,
                "transition-property": "opacity, width",
                "transition-duration": "0.15s",
            },
        },
        {
            selector: ".highlighted",
            style: {
                "background-color": "#1a3050",
                "border-color": "#ffffff",
                "border-width": 3,
                "color": "#ffffff",
                "z-index": 100,
                "font-size": "12px",
            },
        },
        {
            selector: ".dim",
            style: {
                "opacity": 0.12,
            },
        },
        {
            selector: ".edge-highlighted",
            style: {
                "width": 3,
                "opacity": 1,
                "z-index": 50,
            },
        },
        {
            selector: "node:selected",
            style: {
                "border-color": "#ffffff",
                "border-width": 3,
                "z-index": 200,
            },
        },
    ];
}


// ── Main entry: render full graph ─────────────────────────────
function renderFullAdGraph(users, groups, computers) {
    const container = document.getElementById("full-cy");
    if (!container) return;

    if (fullCy) { fullCy.destroy(); fullCy = null; }

    const elements = buildGraphElements(users, groups, computers);
    const nodeCount = elements.filter(e => !e.data.source).length;
    const edgeCount = elements.filter(e => e.data.source).length;

    // Update stats label
    const statsLabel = document.getElementById("graph-stats-label");
    if (statsLabel) statsLabel.textContent = `${nodeCount} nodes · ${edgeCount} edges`;

    fullCy = cytoscape({
        container,
        elements,
        style: buildStylesheet(),
        layout: {
            name: "cose",
            padding: 60,
            nodeRepulsion: () => 800000,
            idealEdgeLength: () => 100,
            edgeElasticity: () => 80,
            gravity: 0.8,
            animate: false,
            randomize: false,
        },
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
        minZoom: 0.05,
        maxZoom: 8,
    });

    // Animate nodes in by group
    ["User", "Group", "Computer"].forEach((type, gi) => {
        fullCy.nodes(`[type="${type}"]`).forEach((node, i) => {
            node.style({ opacity: 0 });
            setTimeout(() => {
                node.animate({ style: { opacity: 1 } }, { duration: 200 });
            }, gi * 200 + i * 20);
        });
    });

    // ── Click handler ──────────────────────────────────────────
    fullCy.on("tap", "node", (evt) => {
        const node = evt.target;
        graphSelectedNode = node;
        showGraphNodeDetail(node);

        // Dim everything, highlight this node + its neighbourhood
        fullCy.elements().addClass("dim").removeClass("highlighted edge-highlighted");
        const neighbourhood = node.closedNeighborhood();
        neighbourhood.removeClass("dim").addClass("highlighted");
        neighbourhood.edges().removeClass("dim").addClass("edge-highlighted");
        node.removeClass("dim");
    });

    fullCy.on("tap", (evt) => {
        if (evt.target === fullCy) {
            resetGraphHighlight();
        }
    });

    // ── Tooltip on hover ───────────────────────────────────────
    fullCy.on("mouseover", "node", (evt) => {
        evt.target.style({ "border-width": 3 });
    });
    fullCy.on("mouseout", "node", (evt) => {
        const n = evt.target;
        if (!n.hasClass("highlighted")) {
            n.style({ "border-width": n.data("isHvt") || n.data("isDC") ? 3 : 2 });
        }
    });

    // Hide loading overlay
    const loading = document.getElementById("graph-loading");
    if (loading) loading.style.display = "none";

    return fullCy;
}


// ── Node detail side panel ─────────────────────────────────────
function showGraphNodeDetail(node) {
    const d = node.data();
    const panel = document.getElementById("graph-node-detail");
    if (!panel) return;

    document.getElementById("gnd-type").textContent = `${d.type}`;
    document.getElementById("gnd-type").style.color =
        NODE_STYLES[d.type]?.border || "#8896b3";
    document.getElementById("gnd-name").textContent = d.sam || d.label;

    const neighbours = node.neighborhood("node");
    const inEdges = node.incomers("edge");
    const outEdges = node.outgoers("edge");

    const rows = [];
    if (d.type === "User") {
        if (d.isAdmin) rows.push(["⚡ Admin", "Yes"]);
        if (d.disabled) rows.push(["⊘ Disabled", "Yes"]);
        if (d.hasSpn) rows.push(["🔑 Kerberoastable", "Yes"]);
    }
    if (d.type === "Group") {
        rows.push(["Members", String(d.memberCount || 0)]);
        if (d.isPrivileged) rows.push(["⚡ Privileged", "Yes"]);
    }
    if (d.type === "Computer") {
        if (d.isDC) rows.push(["★ Domain Controller", "Yes"]);
        if (d.os) rows.push(["OS", d.os]);
    }
    rows.push(["Neighbours", String(neighbours.length)]);
    rows.push(["In-edges", String(inEdges.length)]);
    rows.push(["Out-edges", String(outEdges.length)]);

    document.getElementById("gnd-props").innerHTML = rows.map(([k, v]) =>
        `<div class="detail-prop">
       <span class="detail-prop-key">${k}</span>
       <span class="detail-prop-val">${v}</span>
     </div>`
    ).join("");

    panel.style.display = "block";
}


// ── Controls ───────────────────────────────────────────────────
function resetGraphHighlight() {
    if (!fullCy) return;
    fullCy.elements().removeClass("highlighted dim edge-highlighted");
    graphSelectedNode = null;
    document.getElementById("gnd-name").textContent = "";
    document.getElementById("gnd-props").innerHTML = "";
    const panel = document.getElementById("graph-node-detail");
    if (panel) panel.style.display = "none";
}

function fitGraph() {
    if (fullCy) fullCy.fit(undefined, 40);
}

function highlightGraphNode(query) {
    if (!fullCy) return;
    fullCy.elements().removeClass("highlighted dim edge-highlighted");
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const matches = fullCy.nodes().filter(n =>
        n.data("sam")?.toLowerCase().includes(q) ||
        n.data("label")?.toLowerCase().includes(q)
    );
    if (!matches.length) return;
    fullCy.elements().addClass("dim");
    matches.closedNeighborhood().removeClass("dim").addClass("highlighted");
    matches.closedNeighborhood().edges().addClass("edge-highlighted").removeClass("dim");
    fullCy.animate({ fit: { eles: matches, padding: 80 } }, { duration: 400 });
}

function changeGraphLayout(layoutName) {
    if (!fullCy) return;
    const layoutOptions = {
        cose: { name: "cose", padding: 60, nodeRepulsion: () => 800000, animate: false },
        breadthfirst: { name: "breadthfirst", directed: true, padding: 40, spacingFactor: 1.4, animate: true },
        circle: { name: "circle", padding: 40, animate: true },
        concentric: {
            name: "concentric", padding: 40, animate: true,
            concentric: n => n.data("isHvt") ? 10 : (n.data("type") === "Group" ? 6 : 3)
        },
        grid: { name: "grid", padding: 40, animate: true },
    };
    const opts = layoutOptions[layoutName] || layoutOptions.cose;
    fullCy.layout(opts).run();
}

function toggleGraphFilter(typeKey) {
    if (!fullCy) return;
    graphActiveFilters[typeKey] = !graphActiveFilters[typeKey];
    const btn = document.getElementById(`gf-${typeKey}`);
    if (btn) {
        if (graphActiveFilters[typeKey]) btn.classList.add("active");
        else btn.classList.remove("active");
    }
    const typeMap = { users: "User", groups: "Group", computers: "Computer" };
    const nodeType = typeMap[typeKey];
    const nodes = fullCy.nodes(`[type="${nodeType}"]`);
    if (graphActiveFilters[typeKey]) {
        nodes.style({ display: "element" });
        // restore connected edges
        nodes.connectedEdges().style({ display: "element" });
    } else {
        nodes.style({ display: "none" });
        nodes.connectedEdges().style({ display: "none" });
    }
}

function showConnectedEdges() {
    if (!fullCy || !graphSelectedNode) return;
    const node = graphSelectedNode;
    fullCy.elements().addClass("dim").removeClass("highlighted edge-highlighted");
    const neighbourhood = node.openNeighborhood();
    neighbourhood.removeClass("dim").addClass("highlighted");
    neighbourhood.edges().addClass("edge-highlighted").removeClass("dim");
    node.removeClass("dim").addClass("highlighted");
    fullCy.animate({ fit: { eles: node.closedNeighborhood(), padding: 60 } }, { duration: 350 });
}

let _graphJumpTarget = null;
function jumpToObjectFromGraph() {
    if (!graphSelectedNode) return;
    const d = graphSelectedNode.data();
    const tab = { User: "users", Group: "groups", Computer: "computers" }[d.type] || "users";
    jumpToObject(tab, d.sam);
}


// ── Attack path graph (used in paths panel) ───────────────────
let pathCy = null;

function renderPathGraph(edges, containerId = "cy-container") {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (pathCy) { pathCy.destroy(); pathCy = null; }

    const nodeMap = new Map();
    edges.forEach(e => {
        if (!nodeMap.has(e.from)) nodeMap.set(e.from, e.from_type || "Unknown");
        if (!nodeMap.has(e.to)) nodeMap.set(e.to, e.to_type || "Unknown");
    });

    const cyNodes = Array.from(nodeMap).map(([id, type]) => {
        const s = NODE_STYLES[type] || NODE_STYLES.Unknown;
        return { data: { id, label: id, type, _bg: s.bg, _border: s.border } };
    });
    const cyEdges = edges.map((e, i) => ({
        data: {
            id: `e${i}`, source: e.from, target: e.to, label: e.type,
            _color: EDGE_PALETTE[e.type] || EDGE_PALETTE.default
        },
    }));

    container.style.display = "block";

    pathCy = cytoscape({
        container,
        elements: { nodes: cyNodes, edges: cyEdges },
        style: buildStylesheet(),
        layout: {
            name: "breadthfirst",
            directed: true,
            padding: 50,
            spacingFactor: 1.6,
            avoidOverlap: true,
        },
        userZoomingEnabled: true,
        userPanningEnabled: true,
    });

    // Animate in
    pathCy.nodes().forEach((n, i) => {
        n.style({ opacity: 0 });
        setTimeout(() => n.animate({ style: { opacity: 1 } }, { duration: 200 }), i * 100);
    });
    return pathCy;
}

function destroyGraph() {
    if (fullCy) { fullCy.destroy(); fullCy = null; }
    if (pathCy) { pathCy.destroy(); pathCy = null; }
}
