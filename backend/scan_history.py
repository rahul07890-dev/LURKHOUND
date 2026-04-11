"""
Scan History — SQLite-backed persistence for scan results.
Feature 2: Save / list / compare scans.
"""
import os
import json
import sqlite3
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

DB_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH = os.path.join(DB_DIR, 'scan_history.db')


def _connect() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            domain      TEXT    NOT NULL,
            dc_ip       TEXT    NOT NULL,
            timestamp   TEXT    NOT NULL,
            risk_score  INTEGER NOT NULL DEFAULT 0,
            risk_level  TEXT    NOT NULL DEFAULT 'Low',
            summary     TEXT    NOT NULL DEFAULT '{}',
            paths_count INTEGER NOT NULL DEFAULT 0,
            findings_count INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scan_details (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id   INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
            data_type TEXT    NOT NULL,
            data_json TEXT    NOT NULL
        )
    """)
    conn.commit()
    return conn


def save_scan(session_data: Dict[str, Any]) -> int:
    """Save a full scan result. Returns the scan ID."""
    conn = _connect()
    try:
        summary = session_data.get('summary', {})
        ts = datetime.now(timezone.utc).isoformat()
        cur = conn.execute(
            """INSERT INTO scans (domain, dc_ip, timestamp, risk_score, risk_level,
                                  summary, paths_count, findings_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                summary.get('domain', ''),
                summary.get('dc_ip', ''),
                ts,
                summary.get('risk_score', 0),
                summary.get('risk_level', 'Low'),
                json.dumps(summary),
                len(session_data.get('attack_paths', [])),
                len(session_data.get('findings', [])),
            )
        )
        scan_id = cur.lastrowid

        # Store detail blobs
        for dtype in ('attack_paths', 'findings', 'users', 'groups', 'computers',
                      'gpos', 'ous', 'trusts', 'password_policies'):
            data = session_data.get(dtype, [])
            if data:
                conn.execute(
                    "INSERT INTO scan_details (scan_id, data_type, data_json) VALUES (?, ?, ?)",
                    (scan_id, dtype, json.dumps(data))
                )

        conn.commit()
        logger.info(f"Saved scan {scan_id} for {summary.get('domain', '?')}")
        return scan_id
    finally:
        conn.close()


def list_scans(limit: int = 50) -> List[Dict]:
    """List recent scans (metadata only)."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT id, domain, dc_ip, timestamp, risk_score, risk_level, "
            "paths_count, findings_count FROM scans ORDER BY id DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_scan(scan_id: int) -> Optional[Dict]:
    """Get a complete scan by ID."""
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
        if not row:
            return None
        result = dict(row)
        result['summary'] = json.loads(result.get('summary', '{}'))
        details = conn.execute(
            "SELECT data_type, data_json FROM scan_details WHERE scan_id = ?",
            (scan_id,)
        ).fetchall()
        for d in details:
            result[d['data_type']] = json.loads(d['data_json'])
        return result
    finally:
        conn.close()


def diff_scans(id1: int, id2: int) -> Dict:
    """Compare two scans and return differences."""
    scan1 = get_scan(id1)
    scan2 = get_scan(id2)
    if not scan1 or not scan2:
        return {"error": "One or both scans not found"}

    # Compare findings
    f1_ids = {f.get('id', f.get('title', '')) for f in scan1.get('findings', [])}
    f2_ids = {f.get('id', f.get('title', '')) for f in scan2.get('findings', [])}
    new_findings = [f for f in scan2.get('findings', []) if f.get('id', f.get('title', '')) not in f1_ids]
    resolved_findings = [f for f in scan1.get('findings', []) if f.get('id', f.get('title', '')) not in f2_ids]

    # Compare attack paths
    p1_chains = {p.get('chain', '') for p in scan1.get('attack_paths', [])}
    p2_chains = {p.get('chain', '') for p in scan2.get('attack_paths', [])}
    new_paths = [p for p in scan2.get('attack_paths', []) if p.get('chain', '') not in p1_chains]
    resolved_paths = [p for p in scan1.get('attack_paths', []) if p.get('chain', '') not in p2_chains]

    return {
        "scan1": {"id": id1, "timestamp": scan1.get('timestamp'), "risk_score": scan1.get('risk_score')},
        "scan2": {"id": id2, "timestamp": scan2.get('timestamp'), "risk_score": scan2.get('risk_score')},
        "risk_score_delta": (scan2.get('risk_score', 0) or 0) - (scan1.get('risk_score', 0) or 0),
        "new_findings": new_findings,
        "resolved_findings": resolved_findings,
        "new_paths": new_paths,
        "resolved_paths": resolved_paths,
        "new_findings_count": len(new_findings),
        "resolved_findings_count": len(resolved_findings),
        "new_paths_count": len(new_paths),
        "resolved_paths_count": len(resolved_paths),
    }
