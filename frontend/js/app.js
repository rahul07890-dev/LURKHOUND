/**
 * Main Application Logic
 * Dashboard controller: login, panel navigation, all UI rendering.
 */

"use strict";

// ── State ──
let currentPanel = "overview";
let currentObjectTab = "users";
let allObjects = { users: [], groups: [], computers: [] };
let allPaths = [];
let allFindings = [];
let selectedPathIndex = -1;
let graphRendered = false;  // lazy-init: only build graph on first visit

// ══════════════════════════════════
// PANEL NAVIGATION
// ══════════════════════════════════
function showPanel(name) {
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    const panel = document.getElementById(`panel-${name}`);
    const tab = document.getElementById(`tab-${name}`);
    if (panel) panel.classList.add("active");
    if (tab) tab.classList.add("active");
    currentPanel = name;

    // Lazy-init BloodHound graph on first visit to Graph View tab
    if (name === "graph" && !graphRendered
        && (allObjects.users.length || allObjects.groups.length || allObjects.computers.length)) {
        graphRendered = true;
        setTimeout(() => renderFullAdGraph(allObjects.users, allObjects.groups, allObjects.computers), 60);
    }
}

// ══════════════════════════════════
// LOGIN
// ══════════════════════════════════
async function handleLogin(e) {
    e.preventDefault();
    const dcIp = document.getElementById("dc-ip").value.trim();
    const domain = document.getElementById("domain").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const useLdaps = document.getElementById("use-ldaps").checked;

    if (!dcIp || !username || !password || !domain) {
        showLoginError("Please fill in all fields.");
        return;
    }

    setLoginLoading(true);
    clearLoginError();

    try {
        const result = await authenticate(dcIp, username, password, domain, useLdaps);
        // Clear password field immediately
        document.getElementById("password").value = "";

        if (result.success) {
            await loadDashboard(result.summary);
        }
    } catch (err) {
        showLoginError(err.message || "Authentication failed.");
        document.getElementById("password").value = "";
    } finally {
        setLoginLoading(false);
    }
}

function setLoginLoading(loading) {
    const btn = document.getElementById("btn-login");
    const text = document.getElementById("btn-login-text");
    const spinner = document.getElementById("btn-login-spinner");
    btn.disabled = loading;
    text.style.display = loading ? "none" : "flex";
    spinner.style.display = loading ? "block" : "none";
}

function showLoginError(msg) {
    const el = document.getElementById("login-error");
    el.textContent = "⚠ " + msg;
    el.style.display = "block";
}

function clearLoginError() {
    const el = document.getElementById("login-error");
    el.style.display = "none";
}

// ══════════════════════════════════
// DASHBOARD LOAD
// ══════════════════════════════════
async function loadDashboard(summary) {
    // Switch screens
    document.getElementById("screen-login").style.display = "none";
    document.getElementById("screen-dashboard").style.display = "block";

    // Update nav
    document.getElementById("btn-logout").style.display = "block";
    document.getElementById("nav-domain").textContent = summary.domain || "MARVEL.local";
    document.getElementById("overview-domain-label").textContent = summary.domain || "MARVEL.local";

    // Update risk pill
    updateRiskPill(summary.risk_level, summary.risk_score);

    // Render overview with already-available summary
    renderOverview(summary);

    // Load rest of data in background
    try {
        const [users, groups, computers, paths, findings] = await Promise.all([
            getUsers(),
            getGroups(),
            getComputers(),
            getAttackPaths(),
            getFindings(),
        ]);
        allObjects = { users, groups, computers };
        allPaths = paths;
        allFindings = findings;

        // Update badge
        const badge = document.getElementById("findings-badge");
        const critCount = findings.filter(f => f.severity === "Critical").length;
        if (critCount > 0) {
            badge.textContent = critCount;
            badge.style.display = "flex";
        }

        // Re-render overview with full data
        const updatedSummary = getCachedSummary();
        renderOverview({ ...updatedSummary, ...summary });

        // Pre-render object explorer
        renderObjectList("users");
        renderPathsList(paths);
        renderFindingsList(findings);
    } catch (err) {
        console.error("Failed to load full data:", err);
    }
}

// ══════════════════════════════════
// OVERVIEW PANEL
// ══════════════════════════════════
function renderOverview(summary) {
    animateNumber("stat-users", summary.total_users || 0);
    animateNumber("stat-groups", summary.total_groups || 0);
    animateNumber("stat-computers", summary.total_computers || 0);
    animateNumber("stat-privileged", summary.privileged_accounts || 0);
    animateNumber("stat-paths", summary.attack_paths_found || 0);
    animateNumber("stat-findings", summary.findings_count || 0);

    renderRiskGauge(summary.risk_score || 0, summary.risk_level || "Low");
    renderDomainAdmins(summary.domain_admins || []);
    renderTopRisks();
}

function animateNumber(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    let current = 0;
    const step = Math.ceil(target / 20);
    const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(timer);
    }, 30);
}

function renderRiskGauge(score, level) {
    const ring = document.getElementById("gauge-ring");
    const scoreEl = document.getElementById("gauge-score");
    const levelEl = document.getElementById("gauge-level");
    if (!ring) return;

    const pct = Math.min(100, score);
    const colorMap = { Low: "#34d399", Medium: "#fbbf24", High: "#fb923c", Critical: "#f87171" };
    const color = colorMap[level] || "#4f9cf9";

    ring.style.background = `conic-gradient(${color} 0% ${pct}%, rgba(255,255,255,0.06) ${pct}% 100%)`;
    scoreEl.textContent = score;
    scoreEl.style.color = color;
    levelEl.textContent = level;
    levelEl.style.color = color;

    // Update nav risk pill
    updateRiskPill(level, score);
}

function updateRiskPill(level, score) {
    const pill = document.getElementById("risk-pill");
    if (!pill) return;
    pill.className = `risk-pill ${(level || "low").toLowerCase()}`;
    pill.textContent = `${level || "—"} RISK (${score || 0}/100)`;
    pill.style.display = "flex";
}

function renderDomainAdmins(admins) {
    const el = document.getElementById("domain-admins-list");
    if (!el) return;
    if (!admins.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✓</div>No Domain Admins detected</div>`;
        return;
    }
    el.innerHTML = admins.map(name => `
    <div class="admin-badge">
      <div class="admin-avatar">${name.charAt(0).toUpperCase()}</div>
      <div>
        <div class="admin-name">${escHtml(name)}</div>
        <div class="admin-role">Domain Administrator</div>
      </div>
    </div>
  `).join("");
}

function renderTopRisks() {
    const el = document.getElementById("top-risks-list");
    if (!el) return;
    const findings = allFindings.length ? allFindings : getCachedFindings();
    if (!findings.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✓</div>No findings yet — data still loading</div>`;
        return;
    }
    el.innerHTML = findings.slice(0, 5).map(f => `
    <div class="risk-item">
      <span class="sev-badge sev-${f.severity}">${f.severity}</span>
      <span style="flex:1; font-size:13px">${escHtml(f.title)}</span>
      <span style="font-size:11px; color:var(--text-muted)">${(f.affected_objects || []).slice(0, 2).join(", ")}</span>
    </div>
  `).join("");
}

function quickFind(query) {
    const res = document.getElementById("quickfind-results");
    if (!query.trim()) { res.style.display = "none"; return; }
    const q = query.toLowerCase();
    const all = [
        ...allObjects.users.map(o => ({ ...o, _type: "👤" })),
        ...allObjects.groups.map(o => ({ ...o, _type: "👥" })),
        ...allObjects.computers.map(o => ({ ...o, _type: "💻" })),
    ];
    const matches = all.filter(o =>
        (o.sam_account_name || "").toLowerCase().includes(q) ||
        (o.display_name || "").toLowerCase().includes(q)
    ).slice(0, 8);

    if (!matches.length) { res.style.display = "none"; return; }
    res.innerHTML = matches.map(o => `
    <div class="qf-result" onclick="jumpToObject('${escHtml(o.object_type.toLowerCase() + "s")}', '${escHtml(o.sam_account_name || "")}')">
      <span>${o._type}</span>
      <span>${escHtml(o.sam_account_name || o.display_name || "")}</span>
      <span style="color:var(--text-muted);margin-left:auto">${escHtml(o.object_type)}</span>
    </div>
  `).join("");
    res.style.display = "flex";
}

function jumpToObject(tabName, samName) {
    document.getElementById("quickfind-results").style.display = "none";
    showPanel("objects");
    switchObjectTab(tabName);
    setTimeout(() => {
        const items = document.querySelectorAll(".obj-item");
        for (const item of items) {
            if (item.dataset.sam === samName.toUpperCase()) {
                item.click();
                item.scrollIntoView({ behavior: "smooth", block: "center" });
                break;
            }
        }
    }, 100);
}

// ══════════════════════════════════
// OBJECT EXPLORER
// ══════════════════════════════════
function switchObjectTab(type) {
    document.querySelectorAll(".obj-tab").forEach(t => t.classList.remove("active"));
    const tab = document.getElementById(`obj-tab-${type}`);
    if (tab) tab.classList.add("active");
    currentObjectTab = type;
    document.getElementById("object-search").value = "";
    renderObjectList(type);
    document.getElementById("object-detail").innerHTML = `
    <div class="detail-placeholder">
      <div class="placeholder-icon">◎</div>
      <p>Select an object to view details</p>
    </div>`;
}

function renderObjectList(type, filter = "") {
    const list = document.getElementById("objects-list");
    if (!list) return;
    let items = allObjects[type] || [];
    if (filter) {
        const q = filter.toLowerCase();
        items = items.filter(o =>
            (o.sam_account_name || "").toLowerCase().includes(q) ||
            (o.display_name || "").toLowerCase().includes(q) ||
            (o.description || "").toLowerCase().includes(q)
        );
    }

    if (!items.length) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◯</div>No objects found</div>`;
        return;
    }

    list.innerHTML = items.map(obj => {
        const icon = { User: "👤", Group: "👥", Computer: "💻" }[obj.object_type] || "◯";
        const attrs = obj.attributes || {};
        const tags = [];
        if (attrs.is_admin || attrs.adminCount === "1") tags.push(`<span class="obj-tag tag-admin">ADMIN</span>`);
        if (obj.object_type === "Computer" && attrs.is_domain_controller) tags.push(`<span class="obj-tag tag-dc">DC</span>`);
        if (attrs.is_disabled) tags.push(`<span class="obj-tag tag-disabled">DISABLED</span>`);
        if (attrs.has_spn) tags.push(`<span class="obj-tag tag-spn">SPN</span>`);
        const memberCount = (obj.members || []).length;
        const sub = obj.object_type === "Group"
            ? `${memberCount} member${memberCount !== 1 ? "s" : ""}`
            : obj.description || obj.display_name || "";

        return `
      <div class="obj-item" data-sam="${escHtml((obj.sam_account_name || "").toUpperCase())}"
           onclick="selectObject(this, '${escHtml(obj.sam_account_name || "")}', '${escHtml(obj.object_type)}')">
        <span class="obj-type-icon">${icon}</span>
        <div style="flex:1;overflow:hidden">
          <div class="obj-item-name" title="${escHtml(obj.sam_account_name || "")}">${escHtml(obj.sam_account_name || obj.display_name || "")}</div>
          <div class="obj-item-sub" title="${escHtml(sub)}">${escHtml(sub.slice(0, 40))}</div>
        </div>
        <div class="obj-tags">${tags.join("")}</div>
      </div>`;
    }).join("");
}

function filterObjects(q) { renderObjectList(currentObjectTab, q); }

function selectObject(el, samName, objType) {
    document.querySelectorAll(".obj-item").forEach(i => i.classList.remove("selected"));
    el.classList.add("selected");
    renderObjectDetail(samName, objType);
}

function renderObjectDetail(samName, objType) {
    const typeList = objType.toLowerCase() + "s";
    const obj = (allObjects[typeList] || []).find(o =>
        (o.sam_account_name || "").toUpperCase() === samName.toUpperCase()
    );
    const detail = document.getElementById("object-detail");
    if (!obj) { detail.innerHTML = `<div class="empty-state">Object not found</div>`; return; }

    const attrs = obj.attributes || {};
    const typeColor = { User: "#4f9cf9", Group: "#a855f7", Computer: "#2dd4bf" }[objType] || "#8896b3";

    // Find related findings and paths
    const relatedFindings = allFindings.filter(f => (f.affected_objects || []).includes(obj.sam_account_name || ""));
    const relatedPaths = allPaths.filter(p => (p.path || []).includes(obj.sam_account_name || ""));

    // Build properties table
    const props = [];
    if (obj.description) props.push(["Description", obj.description]);
    if (attrs.mail) props.push(["Email", attrs.mail]);
    if (attrs.userPrincipalName) props.push(["UPN", attrs.userPrincipalName]);
    if (attrs.os) props.push(["OS", attrs.os]);
    if (attrs.hostname) props.push(["Hostname", attrs.hostname]);
    if (obj.sid) props.push(["SID", obj.sid.slice(0, 40) + (obj.sid.length > 40 ? "…" : "")]);
    if (attrs.is_admin !== undefined) props.push(["Is Admin", String(!!attrs.is_admin)]);
    if (attrs.is_disabled !== undefined) props.push(["Is Disabled", String(!!attrs.is_disabled)]);
    if (attrs.is_password_never_expires !== undefined) props.push(["Password Never Expires", String(!!attrs.is_password_never_expires)]);
    if (attrs.has_spn !== undefined) props.push(["Has SPN (Kerberoastable)", String(!!attrs.has_spn)]);
    if (attrs.is_domain_controller !== undefined) props.push(["Domain Controller", String(!!attrs.is_domain_controller)]);
    if (attrs.is_privileged !== undefined) props.push(["Privileged Group", String(!!attrs.is_privileged)]);

    const memberOfList = (obj.member_of || []).map(dn => {
        const name = dn.split(",")[0].replace(/CN=/i, "");
        return `<span class="member-pill" onclick="jumpToObject('groups', '${escHtml(name)}')">${escHtml(name)}</span>`;
    });

    const membersList = (obj.members || []).map(dn => {
        const name = dn.split(",")[0].replace(/CN=/i, "");
        return `<span class="member-pill">${escHtml(name)}</span>`;
    });

    const spns = attrs.servicePrincipalName;

    detail.innerHTML = `
    <div class="detail-header">
      <span class="detail-type-badge ${objType}" style="color:${typeColor}">${objType}</span>
      <div class="detail-name">${escHtml(obj.display_name || obj.sam_account_name || "")}</div>
      <div class="detail-dn">${escHtml(obj.dn || "")}</div>
    </div>

    ${props.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Properties</div>
      ${props.map(([k, v]) => `
        <div class="detail-prop">
          <span class="detail-prop-key">${escHtml(k)}</span>
          <span class="detail-prop-val ${v}">${escHtml(v)}</span>
        </div>`).join("")}
    </div>` : ""}

    ${memberOfList.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Member Of (${memberOfList.length})</div>
      <div class="detail-members">${memberOfList.join("")}</div>
    </div>` : ""}

    ${membersList.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Members (${membersList.length})</div>
      <div class="detail-members">${membersList.join("")}</div>
    </div>` : ""}

    ${spns && spns.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Service Principal Names</div>
      <div class="detail-members">
        ${spns.map(s => `<span class="member-pill" style="color:var(--sev-medium)">${escHtml(s)}</span>`).join("")}
      </div>
    </div>` : ""}

    ${relatedPaths.length ? `
    <div class="detail-section">
      <div class="detail-section-title" style="color:var(--sev-high)">⚡ Involved in ${relatedPaths.length} Attack Path${relatedPaths.length !== 1 ? "s" : ""}</div>
      ${relatedPaths.slice(0, 3).map(p => `
        <div class="risk-item" onclick="showPanel('paths')" style="cursor:pointer; margin-bottom:6px">
          <span class="sev-badge sev-${p.severity}">${p.severity}</span>
          <span style="font-size:11px; font-family:var(--font-mono)">${escHtml(p.chain || p.description || "")}</span>
        </div>`).join("")}
    </div>` : ""}

    ${relatedFindings.length ? `
    <div class="detail-section">
      <div class="detail-section-title" style="color:var(--sev-critical)">⚠ ${relatedFindings.length} Finding${relatedFindings.length !== 1 ? "s" : ""}</div>
      ${relatedFindings.slice(0, 3).map(f => `
        <div class="risk-item" onclick="showPanel('findings')" style="cursor:pointer; margin-bottom:6px">
          <span class="sev-badge sev-${f.severity}">${f.severity}</span>
          <span style="font-size:11px">${escHtml(f.title)}</span>
        </div>`).join("")}
    </div>` : ""}
  `;
}

// ══════════════════════════════════
// ATTACK PATHS
// ══════════════════════════════════
// Path-type → human label + color
const PATH_TYPE_META = {
    dcsync_risk: { label: "DCSync / Golden Ticket", color: "#ef4444", icon: "⚡" },
    admin_to_dc: { label: "Admin → Domain Controller", color: "#ef4444", icon: "⚡" },
    admin_to_workstation: { label: "Lateral Movement", color: "#fb923c", icon: "→" },
    kerberoast_escalation: { label: "Kerberoasting", color: "#f59e0b", icon: "🔑" },
    generic_all_abuse: { label: "GenericAll Abuse", color: "#ef4444", icon: "🔓" },
    write_dacl_abuse: { label: "WriteDACL Abuse", color: "#fb923c", icon: "🔓" },
    write_owner_abuse: { label: "WriteOwner Abuse", color: "#fb923c", icon: "🔓" },
    generic_write_abuse: { label: "GenericWrite Abuse", color: "#fbbf24", icon: "🔓" },
    nested_group_da_escalation: { label: "Nested Group → Domain Admin", color: "#a855f7", icon: "👥" },
    user_to_domain_admin: { label: "Privilege Escalation → DA", color: "#ef4444", icon: "⬆" },
    unconstrained_delegation: { label: "Unconstrained Delegation", color: "#fbbf24", icon: "🎫" },
    stale_privileged_credential: { label: "Stale Privileged Credentials", color: "#fb923c", icon: "⏰" },
    lateral_movement: { label: "Lateral Movement", color: "#fb923c", icon: "→" },
};

function prettifyPathType(pt) {
    const m = PATH_TYPE_META[pt];
    return m ? `${m.icon} ${m.label}` : (pt || "Unknown").replace(/_/g, " ");
}

function pathTypeColor(pt) {
    return (PATH_TYPE_META[pt] || {}).color || "#8896b3";
}

function renderPathsList(paths) {
    const wrap = document.getElementById("paths-list");
    if (!wrap) return;
    if (!paths.length) {
        wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✓</div>No attack paths detected — environment looks clean!</div>`;
        return;
    }
    wrap.innerHTML = paths.map((p, i) => {
        const ptColor = pathTypeColor(p.path_type);
        const ptLabel = prettifyPathType(p.path_type);
        const hopLabel = p.length === 0 ? "Config" : `${p.length} hop${p.length !== 1 ? "s" : ""}`;
        // Up to 2 MITRE badges on the card
        const mitreMini = (p.mitre_techniques || []).slice(0, 2).map(t =>
            `<span class="mitre-mini-badge" title="${escHtml(t.name)}">${escHtml(t.id)}</span>`
        ).join("");
        // Short description clip
        const descClip = (p.description || "").slice(0, 90) + ((p.description || "").length > 90 ? "…" : "");

        return `
    <div class="path-item" id="path-item-${i}" onclick="selectPath(${i})">
      <div class="path-item-header">
        <span class="sev-badge sev-${p.severity}">${p.severity}</span>
        <span class="path-type-badge" style="color:${ptColor};background:${ptColor}1a;border-color:${ptColor}44">${ptLabel}</span>
        <span style="font-size:10px;color:var(--text-muted);margin-left:auto;flex-shrink:0">${hopLabel}</span>
      </div>
      <div class="path-src-tgt">
        <span class="path-node-chip src">${escHtml(p.source || "")}</span>
        <span class="path-arrow-sep">→</span>
        <span class="path-node-chip tgt">${escHtml(p.target || "")}</span>
      </div>
      <div class="path-desc-clip">${escHtml(descClip)}</div>
      ${mitreMini ? `<div class="path-mitre-row">${mitreMini}</div>` : ""}
    </div>`;
    }).join("");
}

function filterPaths() {
    const sevFilter = document.getElementById("path-filter-severity").value;
    const typeFilter = document.getElementById("path-filter-type").value;
    let paths = allPaths;
    if (sevFilter !== "ALL") paths = paths.filter(p => p.severity === sevFilter);
    if (typeFilter !== "ALL") paths = paths.filter(p => p.path_type === typeFilter);
    renderPathsList(paths);
}

function selectPath(index) {
    // Get the correct path from filtered or full list
    const sevFilter = document.getElementById("path-filter-severity").value;
    const typeFilter = document.getElementById("path-filter-type").value;
    let paths = allPaths;
    if (sevFilter !== "ALL") paths = paths.filter(p => p.severity === sevFilter);
    if (typeFilter !== "ALL") paths = paths.filter(p => p.path_type === typeFilter);
    const path = paths[index];
    if (!path) return;

    document.querySelectorAll(".path-item").forEach(el => el.classList.remove("selected"));
    document.getElementById(`path-item-${index}`)?.classList.add("selected");

    // Show graph
    const placeholder = document.getElementById("path-graph-placeholder");
    if (placeholder) placeholder.style.display = "none";

    if (path.edges && path.edges.length > 0) {
        renderPathGraph(path.edges, "cy-container");
    }

    // Show chain
    renderChainDisplay(path);
    renderMitreDisplay(path.mitre_techniques || []);
}

function renderChainDisplay(path) {
    const el = document.getElementById("path-chain-display");
    if (!el) return;
    el.style.display = "block";

    const ptColor = pathTypeColor(path.path_type);
    const ptLabel = prettifyPathType(path.path_type);
    const hopLabel = path.length === 0 ? "Configuration Risk" : `${path.length}-hop path`;
    const edges = path.edges || [];

    // Node chip colors by type
    const nodeColor = { User: "#4f9cf9", Group: "#a855f7", Computer: "#2dd4bf", Unknown: "#8896b3" };
    const edgeColor = {
        AdminTo: "#ef4444", GenericAll: "#ef4444", WriteDACL: "#fbbf24",
        WriteOwner: "#fb923c", GenericWrite: "#fb923c", MemberOf: "#4f9cf9",
        StaleCredential: "#94a3b8", Unknown: "#8896b3",
    };

    // Build visual chain
    let chainHtml = "";
    if (edges.length > 0) {
        const firstNode = edges[0];
        const nc0 = nodeColor[firstNode.from_type] || "#8896b3";
        chainHtml += `<div class="kc-node" style="border-color:${nc0};color:${nc0}">
            <div class="kc-node-type">${escHtml(firstNode.from_type)}</div>
            <div class="kc-node-name">${escHtml(firstNode.from)}</div>
          </div>`;
        edges.forEach(e => {
            const ec = edgeColor[e.type] || "#8896b3";
            const nc = nodeColor[e.to_type] || "#8896b3";
            chainHtml += `
          <div class="kc-edge" style="color:${ec}">
            <div class="kc-edge-bar" style="background:${ec}"></div>
            <div class="kc-edge-label">${escHtml(e.type)}</div>
            <div class="kc-edge-bar" style="background:${ec}"></div>
          </div>
          <div class="kc-node" style="border-color:${nc};color:${nc}">
            <div class="kc-node-type">${escHtml(e.to_type)}</div>
            <div class="kc-node-name">${escHtml(e.to)}</div>
          </div>`;
        });
    } else {
        // 0-hop config risk — show single node
        chainHtml = `<div class="kc-node" style="border-color:#fbbf24;color:#fbbf24">
            <div class="kc-node-type">Object</div>
            <div class="kc-node-name">${escHtml(path.source || path.target || "")}</div>
          </div>`;
    }

    el.innerHTML = `
    <div class="chain-header">
      <span class="path-type-badge" style="color:${ptColor};background:${ptColor}1a;border-color:${ptColor}44">${ptLabel}</span>
      <span class="chain-hop-label">${hopLabel}</span>
    </div>
    <div class="chain-title">${escHtml(path.description || "")}</div>
    <div class="kc-chain">${chainHtml}</div>
  `;
}

function renderMitreDisplay(techniques) {
    const el = document.getElementById("path-mitre-display");
    if (!el) return;
    if (!techniques || !techniques.length) { el.style.display = "none"; return; }
    el.style.display = "block";
    el.innerHTML = `
    <div class="mitre-title">🛡 MITRE ATT&CK Techniques</div>
    <div class="mitre-tags">
      ${techniques.map(t => `
        <div class="mitre-tag">
          <span class="mitre-id">${escHtml(t.id)}</span>
          <span class="mitre-name">${escHtml(t.name)}</span>
          <a href="${escHtml(t.url)}" target="_blank" class="mitre-link">↗</a>
        </div>`).join("")}
    </div>
  `;
}

// ══════════════════════════════════
// FINDINGS
// ══════════════════════════════════
function renderFindingsList(findings) {
    const el = document.getElementById("findings-list");
    if (!el) return;
    if (!findings.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✓</div>No findings detected!</div>`;
        return;
    }

    const sevBarColor = { Critical: "#f87171", High: "#fb923c", Medium: "#fbbf24", Low: "#34d399" };

    el.innerHTML = findings.map((f, i) => {
        const psCode = escHtml(f.powershell_fix || "");
        const mitreHtml = (f.mitre_techniques || []).map(t =>
            `<div class="mitre-tag">
        <span class="mitre-id">${escHtml(t.id)}</span>
        <span class="mitre-name">${escHtml(t.name)}</span>
        <a href="${escHtml(t.url)}" target="_blank" class="mitre-link">↗</a>
      </div>`
        ).join("");
        const affectedHtml = (f.affected_objects || []).map(a => `<span class="affected-badge">${escHtml(a)}</span>`).join("");
        const barColor = sevBarColor[f.severity] || "#8896b3";

        return `
    <div class="finding-card" id="finding-${i}">
      <div class="finding-header" onclick="toggleFinding(${i})">
        <div class="finding-sev-bar" style="background:${barColor}"></div>
        <div class="finding-info">
          <div class="finding-title">${escHtml(f.title)}</div>
          <div class="finding-desc-short">${escHtml((f.description || "").slice(0, 100))}${f.description && f.description.length > 100 ? "…" : ""}</div>
        </div>
        <div class="finding-meta">
          <span class="sev-badge sev-${f.severity}">${f.severity}</span>
          <span class="finding-expand" id="expand-icon-${i}">▼</span>
        </div>
      </div>
      <div class="finding-body" id="finding-body-${i}">
        ${f.description ? `
        <div class="finding-section">
          <div class="finding-section-label">Description</div>
          <p>${escHtml(f.description)}</p>
        </div>` : ""}

        ${f.impact ? `
        <div class="finding-section">
          <div class="finding-section-label">Impact</div>
          <p>${escHtml(f.impact)}</p>
        </div>` : ""}

        ${affectedHtml ? `
        <div class="finding-section">
          <div class="finding-section-label">Affected Objects</div>
          <div class="affected-list">${affectedHtml}</div>
        </div>` : ""}

        ${f.remediation ? `
        <div class="finding-section">
          <div class="finding-section-label">Remediation Steps</div>
          <p style="white-space:pre-wrap; font-size:13px">${escHtml(f.remediation)}</p>
        </div>` : ""}

        ${psCode ? `
        <div class="finding-section">
          <div class="finding-section-label">PowerShell Remediation</div>
          <div class="ps-block" id="ps-${i}"><button class="copy-btn" onclick="copyPs(${i})">Copy</button>${colorizePs(f.powershell_fix || "")}</div>
        </div>` : ""}

        ${mitreHtml ? `
        <div class="finding-section">
          <div class="finding-section-label">🛡 MITRE ATT&CK</div>
          <div class="mitre-inline">${mitreHtml}</div>
        </div>` : ""}
      </div>
    </div>`;
    }).join("");
}

function toggleFinding(i) {
    const body = document.getElementById(`finding-body-${i}`);
    const icon = document.getElementById(`expand-icon-${i}`);
    if (body.classList.contains("open")) {
        body.classList.remove("open");
        icon.classList.remove("open");
    } else {
        body.classList.add("open");
        icon.classList.add("open");
    }
}

function filterFindings() {
    const sev = document.getElementById("finding-filter").value;
    let findings = allFindings;
    if (sev !== "ALL") findings = findings.filter(f => f.severity === sev);
    renderFindingsList(findings);
}

function copyPs(i) {
    const ps = allFindings[i]?.powershell_fix || "";
    navigator.clipboard?.writeText(ps).then(() => {
        const btn = document.querySelector(`#ps-${i} .copy-btn`);
        if (btn) { btn.textContent = "Copied!"; setTimeout(() => btn.textContent = "Copy", 1800); }
    });
}

function colorizePs(code) {
    // Simple PowerShell syntax highlighting
    return escHtml(code)
        .replace(/(#[^\n]*)/g, `<span class="ps-comment">$1</span>`)
        .replace(/\b(Get-ADUser|Get-ADGroupMember|Get-ADGroup|Set-ADUser|Remove-ADGroupMember|Get-ACL|Set-ACL|Write-Host|Import-Module|New-Object)\b/g,
            `<span style="color:#80cbc4">$1</span>`)
        .replace(/\$([\w-]+)/g, `<span style="color:#ce93d8">$$$1</span>`)
        .replace(/'([^']+)'/g, `<span style="color:#a5d6a7">'$1'</span>`);
}

// ══════════════════════════════════
// LOGOUT
// ══════════════════════════════════
async function handleLogout() {
    await logout();
    destroyGraph();
    allObjects = { users: [], groups: [], computers: [] };
    allPaths = [];
    allFindings = [];
    graphRendered = false;
    document.getElementById("screen-dashboard").style.display = "none";
    document.getElementById("screen-login").style.display = "block";
    document.getElementById("screen-login").className = "screen active";
    document.getElementById("btn-logout").style.display = "none";
    document.getElementById("risk-pill").style.display = "none";
    document.getElementById("findings-badge").style.display = "none";
    showPanel("overview");
}

// ══════════════════════════════════
// UTILITIES
// ══════════════════════════════════
function escHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}

// Hide quickfind when clicking elsewhere
document.addEventListener("click", e => {
    if (!e.target.closest(".quickfind-wrap")) {
        const r = document.getElementById("quickfind-results");
        if (r) r.style.display = "none";
    }
});
