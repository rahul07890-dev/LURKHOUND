"""
FastAPI Main Application — Active Directory Attack-Path Discovery Mapper
MARVEL.local | LDAPS port 636
"""
import logging
import sys
import os
import math
import json
import secrets
import asyncio
import time
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
import uvicorn

# Add backend directory to path
sys.path.insert(0, os.path.dirname(__file__))

from models import AuthRequest
from auth import authenticate, get_base_dn, close_connection
from ldap_enum import run_full_enumeration
from normalizer import normalize_all
from graph_builder import build_graph, get_hvt_nodes, get_domain_controllers, graph_to_dict
from attack_paths import run_full_discovery
from misconfig_detector import run_all_detections
from remediation import enrich_findings_with_remediation
from scan_history import save_scan, list_scans, get_scan, diff_scans
from report_generator import generate_html_report, generate_json_report
from bloodhound_io import export_bloodhound, import_bloodhound
from risk import calculate_risk_score
from config import API_PORT, LOG_LEVEL, SESSION_TTL_MINUTES, CORS_ORIGINS

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# In-memory session store — NO persistent storage of credentials
# Session holds: enumeration results, graph, findings (not credentials)
SESSION_STORE: Dict[str, Any] = {}


async def _session_reaper():
    """Background task that removes sessions older than SESSION_TTL_MINUTES."""
    while True:
        await asyncio.sleep(60)  # check every minute
        now = time.time()
        ttl_seconds = SESSION_TTL_MINUTES * 60
        expired = [sid for sid, data in SESSION_STORE.items()
                   if now - data.get('_created_at', now) > ttl_seconds]
        for sid in expired:
            del SESSION_STORE[sid]
            logger.info(f"Session {sid[:8]}... expired and cleared (TTL={SESSION_TTL_MINUTES}m)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AD Attack-Path Discovery Mapper starting...")
    logger.info(f"Session TTL: {SESSION_TTL_MINUTES} minutes")
    reaper_task = asyncio.create_task(_session_reaper())
    yield
    reaper_task.cancel()
    SESSION_STORE.clear()
    logger.info("🛑 Server shutting down. Session data cleared.")


app = FastAPI(
    title="AD Attack-Path Discovery Mapper",
    description="Active Directory security analysis — LDAP enumeration, permission graph, attack path discovery.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def _validate_string_input(value: str, field_name: str, max_len: int = 256) -> str:
    """Sanitize string inputs to prevent injection."""
    if not value or not value.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty")
    value = value.strip()
    if len(value) > max_len:
        raise HTTPException(status_code=400, detail=f"{field_name} exceeds maximum length")
    # Block obvious injection characters in usernames
    if field_name in ("username", "domain") and any(c in value for c in ['<', '>', '&', '"', "'"]):
        raise HTTPException(status_code=400, detail=f"Invalid characters in {field_name}")
    return value


@app.get("/")
async def serve_dashboard():
    """Serve the frontend dashboard."""
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'index.html')
    frontend_path = os.path.normpath(frontend_path)
    if os.path.exists(frontend_path):
        return FileResponse(frontend_path)
    return JSONResponse({"message": "AD Attack-Path Discovery Mapper API", "status": "running"})


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "AD Attack-Path Mapper", "version": "1.0.0"}


@app.post("/api/authenticate")
async def api_authenticate(request: AuthRequest):
    """
    Authenticate to Active Directory.
    Returns session_id for subsequent API calls.
    Credentials are NEVER stored — only the resulting connection data.
    """
    # Input validation
    dc_ip = _validate_string_input(request.dc_ip, "dc_ip", 64)
    username = _validate_string_input(request.username, "username", 128)
    domain = _validate_string_input(request.domain, "domain", 128)
    password = request.password  # Not logged, not stored

    logger.info(f"Authentication attempt: {username}@{domain} -> {dc_ip}")

    success, conn, message = authenticate(
        dc_ip=dc_ip,
        username=username,
        password=password,
        domain=domain,
        use_ldaps=request.use_ldaps
    )

    # Clear password immediately
    password = None  # noqa

    if not success:
        raise HTTPException(status_code=401, detail=message)

    # Generate a session ID (not tied to credentials)
    session_id = secrets.token_hex(32)

    # Run enumeration immediately after auth
    try:
        base_dn = get_base_dn(domain)
        raw_data = run_full_enumeration(conn, base_dn)
        close_connection(conn)  # Close LDAP connection — done with auth

        # Normalize data
        normalized = normalize_all(raw_data)

        # Build graph
        G = build_graph(normalized)

        # Discover attack paths
        hvts = get_hvt_nodes(G)
        dcs = get_domain_controllers(G)
        attack_path_list = run_full_discovery(
            G, hvts + dcs,
            gpos=normalized.get('gpos', []),
            ous=normalized.get('ous', []),
        )

        # Detect misconfigurations
        findings = run_all_detections(
            G, normalized['users'], normalized['groups'], normalized['computers'],
            password_policies=normalized.get('password_policies', []),
            trusts=normalized.get('trusts', []),
        )
        findings = enrich_findings_with_remediation(findings)

        # Build domain summary
        users = normalized['users']
        groups = normalized['groups']
        computers = normalized['computers']

        domain_admins = []
        for group in groups:
            if 'domain admins' in group.get('sam_account_name', '').lower():
                for member_dn in group.get('members', []):
                    for user in users:
                        if user['dn'] == member_dn:
                            domain_admins.append(user.get('sam_account_name', ''))

        critical_count = sum(1 for f in findings if f['severity'] == 'Critical')
        high_count     = sum(1 for f in findings if f['severity'] == 'High')
        medium_count   = sum(1 for f in findings if f['severity'] == 'Medium')
        total_findings = len(findings)
        path_count     = len(attack_path_list)

        # ── Risk scoring (via risk.py utility) ──────────────────────────────
        risk_score, risk_level = calculate_risk_score(findings, attack_path_list, users, domain_admins)

        summary = {
            "total_users": len(users),
            "total_groups": len(groups),
            "total_computers": len(computers),
            "privileged_accounts": len([u for u in users if u.get('attributes', {}).get('is_admin')]),
            "domain_admins": domain_admins,
            "attack_paths_found": len(attack_path_list),
            "findings_count": len(findings),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "domain": domain,
            "dc_ip": dc_ip,
        }

        # Store results in session (NOT credentials)
        SESSION_STORE[session_id] = {
            "_created_at": time.time(),
            "users": users,
            "groups": groups,
            "computers": computers,
            "acls": normalized.get('acls', []),
            "attack_paths": attack_path_list,
            "findings": enrich_findings_with_remediation(findings),
            "summary": summary,
            "graph": graph_to_dict(G),
            # Phase 1 data
            "gpos": normalized.get('gpos', []),
            "ous": normalized.get('ous', []),
            "trusts": normalized.get('trusts', []),
            "password_policies": normalized.get('password_policies', []),
        }

        logger.info(f"Session {session_id[:8]}... created. "
                    f"{len(users)} users, {len(groups)} groups, {len(computers)} computers, "
                    f"{len(attack_path_list)} paths, {len(findings)} findings")

        # Auto-save to scan history
        try:
            scan_id = save_scan(SESSION_STORE[session_id])
            SESSION_STORE[session_id]["scan_id"] = scan_id
        except Exception as e:
            logger.warning(f"Failed to save scan history: {e}")

        return {
            "success": True,
            "session_id": session_id,
            "message": f"Successfully enumerated {domain}",
            "summary": summary
        }

    except Exception as e:
        close_connection(conn)
        logger.error(f"Enumeration failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Enumeration failed: {str(e)}")


def _get_session(session_id: str) -> Dict:
    """Retrieve session data or raise 401."""
    if not session_id or session_id not in SESSION_STORE:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please authenticate.")
    return SESSION_STORE[session_id]


@app.get("/api/summary/{session_id}")
async def get_summary(session_id: str):
    """Get the domain overview summary."""
    session = _get_session(session_id)
    return session["summary"]


@app.get("/api/users/{session_id}")
async def get_users(session_id: str):
    """Get all enumerated users with details."""
    session = _get_session(session_id)
    return {"users": session["users"], "count": len(session["users"])}


@app.get("/api/groups/{session_id}")
async def get_groups(session_id: str):
    """Get all enumerated groups with members."""
    session = _get_session(session_id)
    return {"groups": session["groups"], "count": len(session["groups"])}


@app.get("/api/computers/{session_id}")
async def get_computers(session_id: str):
    """Get all enumerated computer objects."""
    session = _get_session(session_id)
    return {"computers": session["computers"], "count": len(session["computers"])}


@app.get("/api/acls/{session_id}")
async def get_acls(session_id: str):
    """Get all ACL relationships."""
    session = _get_session(session_id)
    return {"acls": session["acls"], "count": len(session["acls"])}


@app.get("/api/attack-paths/{session_id}")
async def get_attack_paths(session_id: str):
    """Get all discovered attack paths with MITRE ATT&CK mappings."""
    session = _get_session(session_id)
    return {
        "attack_paths": session["attack_paths"],
        "count": len(session["attack_paths"])
    }


@app.get("/api/findings/{session_id}")
async def get_findings(session_id: str):
    """Get all misconfigurations with remediation guidance."""
    session = _get_session(session_id)
    return {
        "findings": session["findings"],
        "count": len(session["findings"])
    }


@app.get("/api/graph/{session_id}")
async def get_graph(session_id: str):
    """Get the permission graph as nodes/edges for visualization."""
    session = _get_session(session_id)
    return session["graph"]


@app.get("/api/data/{session_id}")
async def get_full_data(session_id: str):
    """
    Return all session data in a single response for the Next.js frontend.
    Avoids multiple sequential fetches.
    """
    session = _get_session(session_id)
    return {
        "users":        session["users"],
        "groups":       session["groups"],
        "computers":    session["computers"],
        "attack_paths": session["attack_paths"],
        "findings":     session["findings"],
        "graph":        session["graph"],
        "summary":      session["summary"],
        # Phase 1 data
        "gpos":              session.get("gpos", []),
        "ous":               session.get("ous", []),
        "trusts":            session.get("trusts", []),
        "password_policies": session.get("password_policies", []),
    }


@app.get("/api/object/{session_id}/{object_name}")
async def get_object_detail(session_id: str, object_name: str):
    """Get detailed information about a specific AD object by name."""
    session = _get_session(session_id)
    name_upper = object_name.upper()

    for obj in session["users"] + session["groups"] + session["computers"]:
        sam = obj.get('sam_account_name', '').upper()
        if sam == name_upper or name_upper in obj.get('dn', '').upper():
            # Find related findings
            related_findings = [
                f for f in session["findings"]
                if obj.get('sam_account_name', '') in f.get('affected_objects', [])
            ]
            # Find paths involving this object
            related_paths = [
                p for p in session["attack_paths"]
                if obj.get('sam_account_name', '') in p.get('path', [])
            ]
            return {
                "object": obj,
                "related_findings": related_findings,
                "related_paths": related_paths,
            }

    raise HTTPException(status_code=404, detail=f"Object '{object_name}' not found")


@app.post("/api/logout/{session_id}")
async def logout(session_id: str):
    """Clear session data."""
    if session_id in SESSION_STORE:
        del SESSION_STORE[session_id]
        logger.info(f"Session {session_id[:8]}... cleared")
    return {"success": True, "message": "Session cleared"}


# ── Phase 2: Scan History (Feature 2) ─────────────────────────────────────────

@app.get("/api/scans")
async def api_list_scans(limit: int = Query(50, ge=1, le=200)):
    """List recent scan history."""
    return {"scans": list_scans(limit=limit)}


@app.get("/api/scans/{scan_id}")
async def api_get_scan(scan_id: int):
    """Get a specific scan by ID."""
    scan = get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@app.get("/api/scans/diff/{id1}/{id2}")
async def api_diff_scans(id1: int, id2: int):
    """Compare two scans and return differences."""
    result = diff_scans(id1, id2)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ── Phase 2: Shortest Path Calculator (Feature 15) ─────────────────────────

@app.get("/api/path/{session_id}")
async def get_shortest_path(session_id: str, source: str = Query(...), target: str = Query(...)):
    """Calculate shortest path between two objects."""
    import networkx as nx
    session = _get_session(session_id)
    graph_data = session["graph"]

    # Rebuild networkx graph
    G = nx.DiGraph()
    for node in graph_data["nodes"]:
        G.add_node(node["id"], **node)
    for edge in graph_data["edges"]:
        G.add_edge(edge["source"], edge["target"], **edge)

    # Find source/target nodes by SAM name
    source_upper = source.upper()
    target_upper = target.upper()
    src_id = tgt_id = None
    for n, data in G.nodes(data=True):
        sam = data.get('sam', '').upper()
        if sam == source_upper:
            src_id = n
        if sam == target_upper:
            tgt_id = n

    if not src_id:
        raise HTTPException(status_code=404, detail=f"Source '{source}' not found")
    if not tgt_id:
        raise HTTPException(status_code=404, detail=f"Target '{target}' not found")

    try:
        path_nodes = nx.shortest_path(G, source=src_id, target=tgt_id)
        edges = []
        for i in range(len(path_nodes) - 1):
            s, t = path_nodes[i], path_nodes[i + 1]
            edata = G.edges[s, t] if G.has_edge(s, t) else {}
            edges.append({
                "from": G.nodes[s].get('sam', s),
                "to": G.nodes[t].get('sam', t),
                "type": edata.get('type', ''),
                "label": edata.get('label', ''),
            })
        return {
            "path": [G.nodes[n].get('sam', n) for n in path_nodes],
            "path_ids": path_nodes,
            "edges": edges,
            "length": len(path_nodes) - 1,
        }
    except nx.NetworkXNoPath:
        return {"path": [], "edges": [], "length": -1, "message": "No path found"}
    except nx.NodeNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Phase 3: Report Export (Feature 1) ─────────────────────────────────────

@app.get("/api/report/{session_id}")
async def get_report(session_id: str, format: str = Query("html")):
    """Generate a downloadable security assessment report."""
    session = _get_session(session_id)
    if format == "json":
        report = generate_json_report(session)
        return JSONResponse(content=report)
    elif format == "pdf":
        # Generate PDF from HTML report
        html_content = generate_html_report(session)
        try:
            from weasyprint import HTML as WeasyprintHTML
            pdf_bytes = WeasyprintHTML(string=html_content).write_pdf()
            from fastapi.responses import Response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="ad_security_report_{session.get("summary", {}).get("domain", "report")}.pdf"'}
            )
        except ImportError:
            # Fallback: serve HTML with PDF note
            raise HTTPException(status_code=501, detail="PDF export requires 'weasyprint'. Install with: pip install weasyprint")
    else:
        html_content = generate_html_report(session)
        return HTMLResponse(
            content=html_content,
            headers={"Content-Disposition": f'attachment; filename="ad_security_report_{session.get("summary", {}).get("domain", "report")}.html"'}
        )


# ── Phase 3: BloodHound Import/Export (Feature 4) ─────────────────────────

@app.get("/api/export/bloodhound/{session_id}")
async def export_bloodhound_data(session_id: str):
    """Export session data to BloodHound-compatible JSON."""
    session = _get_session(session_id)
    bh_data = export_bloodhound(session)
    return JSONResponse(
        content=bh_data,
        headers={"Content-Disposition": 'attachment; filename="bloodhound_export.json"'}
    )


@app.post("/api/import/bloodhound")
async def import_bloodhound_data(request: Request):
    """Import BloodHound/SharpHound JSON data and create a session."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    raw_data = import_bloodhound(body)
    normalized = normalize_all(raw_data)
    G = build_graph(normalized)

    hvts = get_hvt_nodes(G)
    dcs = get_domain_controllers(G)
    attack_path_list = run_full_discovery(
        G, hvts + dcs,
        gpos=normalized.get('gpos', []),
        ous=normalized.get('ous', []),
    )
    findings = run_all_detections(
        G, normalized['users'], normalized['groups'], normalized['computers'],
        password_policies=normalized.get('password_policies', []),
        trusts=normalized.get('trusts', []),
    )
    findings = enrich_findings_with_remediation(findings)

    session_id = secrets.token_hex(32)
    users = normalized['users']
    groups = normalized['groups']
    computers = normalized['computers']

    summary = {
        "total_users": len(users),
        "total_groups": len(groups),
        "total_computers": len(computers),
        "privileged_accounts": len([u for u in users if u.get('attributes', {}).get('is_admin')]),
        "domain_admins": [],
        "attack_paths_found": len(attack_path_list),
        "findings_count": len(findings),
        "risk_score": 0,
        "risk_level": "Low",
        "domain": "Imported",
        "dc_ip": "BloodHound",
    }

    SESSION_STORE[session_id] = {
        "users": users, "groups": groups, "computers": computers,
        "acls": normalized.get('acls', []),
        "attack_paths": attack_path_list,
        "findings": findings,
        "summary": summary,
        "graph": graph_to_dict(G),
        "gpos": [], "ous": [], "trusts": [], "password_policies": [],
    }

    return {"success": True, "session_id": session_id, "summary": summary}


# ── Phase 2: WebSocket Progress (Feature 5) ─────────────────────────────

@app.websocket("/ws/enumerate")
async def ws_enumerate(websocket: WebSocket):
    """WebSocket endpoint for real-time enumeration progress."""
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        dc_ip = data.get("dc_ip", "")
        username = data.get("username", "")
        password = data.get("password", "")
        domain = data.get("domain", "")
        use_ldaps = data.get("use_ldaps", True)

        await websocket.send_json({"stage": "auth", "progress": 5, "message": "Authenticating..."})
        success, conn, message = authenticate(dc_ip=dc_ip, username=username, password=password, domain=domain, use_ldaps=use_ldaps)
        password = None

        if not success:
            await websocket.send_json({"stage": "error", "progress": 0, "message": message})
            await websocket.close()
            return

        await websocket.send_json({"stage": "auth", "progress": 10, "message": "Authenticated. Starting enumeration..."})
        base_dn = get_base_dn(domain)

        # Enumeration stages
        from ldap_enum import (enumerate_users, enumerate_groups, enumerate_computers,
                               enumerate_acls, enumerate_gpos, enumerate_ous,
                               enumerate_trusts, enumerate_password_policies)

        await websocket.send_json({"stage": "users", "progress": 15, "message": "Enumerating users..."})
        raw_users = enumerate_users(conn, base_dn)
        await websocket.send_json({"stage": "users", "progress": 25, "message": f"Found {len(raw_users)} users"})

        await websocket.send_json({"stage": "groups", "progress": 30, "message": "Enumerating groups..."})
        raw_groups = enumerate_groups(conn, base_dn)
        await websocket.send_json({"stage": "groups", "progress": 40, "message": f"Found {len(raw_groups)} groups"})

        await websocket.send_json({"stage": "computers", "progress": 42, "message": "Enumerating computers..."})
        raw_computers = enumerate_computers(conn, base_dn)
        await websocket.send_json({"stage": "computers", "progress": 48, "message": f"Found {len(raw_computers)} computers"})

        await websocket.send_json({"stage": "acls", "progress": 50, "message": "Enumerating ACLs..."})
        all_raw = raw_users + raw_groups + raw_computers
        raw_acls = enumerate_acls(conn, base_dn, all_raw)
        await websocket.send_json({"stage": "acls", "progress": 58, "message": f"Found {len(raw_acls)} ACL entries"})

        await websocket.send_json({"stage": "extra", "progress": 60, "message": "Enumerating GPOs, OUs, trusts..."})
        raw_gpos = enumerate_gpos(conn, base_dn)
        raw_ous = enumerate_ous(conn, base_dn)
        raw_trusts = enumerate_trusts(conn, base_dn)
        raw_ppols = enumerate_password_policies(conn, base_dn)
        close_connection(conn)
        await websocket.send_json({"stage": "extra", "progress": 68, "message": "LDAP enumeration complete"})

        raw_data = {
            "users": raw_users, "groups": raw_groups, "computers": raw_computers,
            "acls": raw_acls, "gpos": raw_gpos, "ous": raw_ous,
            "trusts": raw_trusts, "password_policies": raw_ppols,
        }

        await websocket.send_json({"stage": "normalize", "progress": 70, "message": "Normalizing data..."})
        normalized = normalize_all(raw_data)

        await websocket.send_json({"stage": "graph", "progress": 75, "message": "Building permission graph..."})
        G = build_graph(normalized)

        await websocket.send_json({"stage": "paths", "progress": 80, "message": "Discovering attack paths..."})
        hvts = get_hvt_nodes(G)
        dcs = get_domain_controllers(G)
        attack_path_list = run_full_discovery(G, hvts + dcs, gpos=normalized.get('gpos', []), ous=normalized.get('ous', []))

        await websocket.send_json({"stage": "findings", "progress": 88, "message": "Detecting misconfigurations..."})
        findings = run_all_detections(
            G, normalized['users'], normalized['groups'], normalized['computers'],
            password_policies=normalized.get('password_policies', []),
            trusts=normalized.get('trusts', []),
        )
        findings = enrich_findings_with_remediation(findings)

        await websocket.send_json({"stage": "finalize", "progress": 95, "message": "Finalizing session..."})

        # Build summary and session (same as api_authenticate)
        users = normalized['users']
        groups = normalized['groups']
        computers = normalized['computers']

        domain_admins = []
        for group in groups:
            if 'domain admins' in group.get('sam_account_name', '').lower():
                for member_dn in group.get('members', []):
                    for user in users:
                        if user['dn'] == member_dn:
                            domain_admins.append(user.get('sam_account_name', ''))

        risk_score, risk_level = calculate_risk_score(findings, attack_path_list, users, domain_admins)
        priv_count = len([u for u in users if u.get('attributes', {}).get('is_admin')])

        summary = {
            "total_users": len(users), "total_groups": len(groups), "total_computers": len(computers),
            "privileged_accounts": priv_count, "domain_admins": domain_admins,
            "attack_paths_found": len(attack_path_list), "findings_count": len(findings),
            "risk_score": risk_score, "risk_level": risk_level,
            "domain": domain, "dc_ip": dc_ip,
        }

        session_id = secrets.token_hex(32)
        SESSION_STORE[session_id] = {
            "_created_at": time.time(),
            "users": users, "groups": groups, "computers": computers,
            "acls": normalized.get('acls', []),
            "attack_paths": attack_path_list, "findings": findings,
            "summary": summary, "graph": graph_to_dict(G),
            "gpos": normalized.get('gpos', []), "ous": normalized.get('ous', []),
            "trusts": normalized.get('trusts', []), "password_policies": normalized.get('password_policies', []),
        }

        try:
            scan_id = save_scan(SESSION_STORE[session_id])
            SESSION_STORE[session_id]["scan_id"] = scan_id
        except Exception:
            pass

        await websocket.send_json({
            "stage": "complete", "progress": 100,
            "message": "Enumeration complete",
            "session_id": session_id,
            "summary": summary,
        })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket enumeration error: {e}", exc_info=True)
        try:
            await websocket.send_json({"stage": "error", "progress": 0, "message": str(e)})
        except Exception:
            pass


# ── Remediation Status (Feature 3 — backend portion) ─────────────────────

# In-memory finding status tracking per session
FINDING_STATUS_STORE: Dict[str, Dict[str, str]] = {}

@app.get("/api/finding-status/{session_id}")
async def get_finding_statuses(session_id: str):
    """Get all finding statuses for a session."""
    _get_session(session_id)  # validate session exists
    return {"statuses": FINDING_STATUS_STORE.get(session_id, {})}


@app.post("/api/finding-status/{session_id}")
async def update_finding_status(session_id: str, request: Request):
    """Update the status of a specific finding."""
    _get_session(session_id)
    body = await request.json()
    finding_id = body.get("finding_id", "")
    status = body.get("status", "open")
    if status not in ("open", "acknowledged", "in_progress", "fixed", "accepted_risk"):
        raise HTTPException(status_code=400, detail="Invalid status")
    if session_id not in FINDING_STATUS_STORE:
        FINDING_STATUS_STORE[session_id] = {}
    FINDING_STATUS_STORE[session_id][finding_id] = status
    return {"success": True, "finding_id": finding_id, "status": status}


# Mount frontend static files at root so /css/style.css and /js/*.js resolve correctly
frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.exists(frontend_dir):
    app.mount("/css", StaticFiles(directory=os.path.join(frontend_dir, "css")), name="css")
    app.mount("/js",  StaticFiles(directory=os.path.join(frontend_dir, "js")),  name="js")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=API_PORT,
        reload=False,
        log_level=LOG_LEVEL
    )
