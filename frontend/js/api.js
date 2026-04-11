/**
 * API Communication Layer
 * Handles all HTTP requests to the FastAPI backend.
 */

const API_BASE = "http://localhost:8000";

let SESSION_ID = null;
let SESSION_DATA = {};

/**
 * Make an authenticated API request.
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaults = {
        headers: { "Content-Type": "application/json" },
        ...options,
    };
    try {
        const response = await fetch(url, defaults);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || `HTTP ${response.status}`);
        }
        return data;
    } catch (err) {
        if (err.name === "TypeError" && err.message.includes("fetch")) {
            throw new Error("Cannot connect to backend (localhost:8000). Is the server running?");
        }
        throw err;
    }
}

/**
 * Authenticate and start enumeration.
 * Returns { success, session_id, summary }
 */
async function authenticate(dcIp, username, password, domain, useLdaps) {
    const result = await apiRequest("/api/authenticate", {
        method: "POST",
        body: JSON.stringify({
            dc_ip: dcIp,
            username: username,
            password: password,
            domain: domain,
            use_ldaps: useLdaps,
        }),
    });
    SESSION_ID = result.session_id;
    SESSION_DATA.summary = result.summary;
    return result;
}

async function getSummary() {
    const data = await apiRequest(`/api/summary/${SESSION_ID}`);
    SESSION_DATA.summary = data;
    return data;
}

async function getUsers() {
    const data = await apiRequest(`/api/users/${SESSION_ID}`);
    SESSION_DATA.users = data.users;
    return data.users;
}

async function getGroups() {
    const data = await apiRequest(`/api/groups/${SESSION_ID}`);
    SESSION_DATA.groups = data.groups;
    return data.groups;
}

async function getComputers() {
    const data = await apiRequest(`/api/computers/${SESSION_ID}`);
    SESSION_DATA.computers = data.computers;
    return data.computers;
}

async function getAttackPaths() {
    const data = await apiRequest(`/api/attack-paths/${SESSION_ID}`);
    SESSION_DATA.attackPaths = data.attack_paths;
    return data.attack_paths;
}

async function getFindings() {
    const data = await apiRequest(`/api/findings/${SESSION_ID}`);
    SESSION_DATA.findings = data.findings;
    return data.findings;
}

async function getGraph() {
    const data = await apiRequest(`/api/graph/${SESSION_ID}`);
    SESSION_DATA.graph = data;
    return data;
}

async function getObjectDetail(name) {
    return await apiRequest(`/api/object/${SESSION_ID}/${encodeURIComponent(name)}`);
}

async function logout() {
    if (SESSION_ID) {
        try { await apiRequest(`/api/logout/${SESSION_ID}`, { method: "POST" }); } catch (e) { }
    }
    SESSION_ID = null;
    SESSION_DATA = {};
}

function hasSession() { return !!SESSION_ID; }
function getCachedSummary() { return SESSION_DATA.summary || null; }
function getCachedUsers() { return SESSION_DATA.users || []; }
function getCachedGroups() { return SESSION_DATA.groups || []; }
function getCachedComputers() { return SESSION_DATA.computers || []; }
function getCachedPaths() { return SESSION_DATA.attackPaths || []; }
function getCachedFindings() { return SESSION_DATA.findings || []; }
