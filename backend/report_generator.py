"""
Report Generator — HTML security assessment report.
Feature 1: Downloadable HTML report with exec summary, findings, paths, remediation.
"""
import html
from datetime import datetime, timezone
from typing import Dict, List, Any


def _esc(text: str) -> str:
    return html.escape(str(text)) if text else ""


def _sev_color(sev: str) -> str:
    return {"Critical": "#ef4444", "High": "#f97316", "Medium": "#eab308", "Low": "#22c55e"}.get(sev, "#6b7280")


def generate_html_report(session_data: Dict[str, Any]) -> str:
    """Generate a self-contained HTML security assessment report."""
    summary = session_data.get("summary", {})
    findings = session_data.get("findings", [])
    attack_paths = session_data.get("attack_paths", [])
    domain = _esc(summary.get("domain", "Unknown"))
    dc_ip = _esc(summary.get("dc_ip", ""))
    risk_score = summary.get("risk_score", 0)
    risk_level = summary.get("risk_level", "Low")
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Count severities
    sev_counts = {}
    for f in findings:
        s = f.get("severity", "Low")
        sev_counts[s] = sev_counts.get(s, 0) + 1

    # Build findings HTML
    findings_html = ""
    for i, f in enumerate(findings, 1):
        color = _sev_color(f.get("severity", "Low"))
        affected = ", ".join(f.get("affected_objects", [])[:5])
        remediation_steps = ""
        if f.get("remediation"):
            steps = [l.strip() for l in f["remediation"].split("\\n") if l.strip()]
            remediation_steps = "<ol>" + "".join(f"<li>{_esc(s)}</li>" for s in steps) + "</ol>"
        ps_fix = ""
        if f.get("powershell_fix"):
            ps_fix = f'<div class="ps-block"><pre>{_esc(f["powershell_fix"])}</pre></div>'

        findings_html += f"""
        <div class="finding">
            <div class="finding-header">
                <span class="sev-badge" style="background:{color}20;color:{color};border:1px solid {color}40">{_esc(f.get('severity',''))}</span>
                <span class="finding-title">{_esc(f.get('title',''))}</span>
            </div>
            <p class="desc">{_esc(f.get('description',''))}</p>
            {'<p class="impact"><strong>Impact:</strong> ' + _esc(f.get("impact","")) + '</p>' if f.get("impact") else ''}
            {'<p class="affected"><strong>Affected:</strong> ' + _esc(affected) + '</p>' if affected else ''}
            {('<div class="remediation"><strong>Remediation:</strong>' + remediation_steps + '</div>') if remediation_steps else ''}
            {ps_fix}
        </div>"""

    # Build paths HTML
    paths_html = ""
    for i, p in enumerate(attack_paths[:30], 1):
        color = _sev_color(p.get("severity", "Medium"))
        mitre = ", ".join(t.get("id", "") for t in p.get("mitre_techniques", [])[:4])
        paths_html += f"""
        <tr>
            <td>{i}</td>
            <td><span class="sev-badge" style="background:{color}20;color:{color};border:1px solid {color}40">{_esc(p.get('severity',''))}</span></td>
            <td class="mono">{_esc(p.get('source',''))}</td>
            <td class="mono">{_esc(p.get('target',''))}</td>
            <td>{p.get('length',0)}</td>
            <td class="mono small">{_esc(mitre)}</td>
            <td class="small">{_esc(p.get('description','')[:120])}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AD Security Assessment — {domain}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#0f1117;color:#e2e8f0;line-height:1.6;padding:2rem}}
.container{{max-width:1100px;margin:0 auto}}
h1{{font-size:1.8rem;margin-bottom:.25rem;color:#fff}}
h2{{font-size:1.25rem;margin:2rem 0 1rem;color:#94a3b8;border-bottom:1px solid #1e293b;padding-bottom:.5rem}}
.meta{{color:#64748b;font-size:.85rem;margin-bottom:2rem}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:2rem}}
.stat{{background:#1e293b;border-radius:8px;padding:1rem;text-align:center}}
.stat-val{{font-size:1.5rem;font-weight:700;color:#fff}}
.stat-lbl{{font-size:.75rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em}}
.risk-gauge{{display:flex;align-items:center;gap:1rem;background:#1e293b;border-radius:8px;padding:1.25rem;margin-bottom:2rem}}
.risk-score{{font-size:2.5rem;font-weight:800;min-width:80px;text-align:center}}
.finding{{background:#1e293b;border-radius:8px;padding:1rem;margin-bottom:.75rem}}
.finding-header{{display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem}}
.finding-title{{font-weight:600;color:#fff}}
.sev-badge{{font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase}}
.desc,.impact,.affected{{font-size:.85rem;color:#94a3b8;margin-bottom:.35rem}}
.remediation{{font-size:.85rem;color:#86efac;margin-top:.5rem}}
.remediation ol{{padding-left:1.25rem;margin-top:.35rem}}
.ps-block{{background:#0f172a;border:1px solid #334155;border-radius:6px;margin-top:.5rem;overflow-x:auto}}
.ps-block pre{{padding:.75rem;font-size:.78rem;color:#4ade80;white-space:pre-wrap}}
table{{width:100%;border-collapse:collapse;font-size:.82rem}}
th{{background:#1e293b;color:#94a3b8;text-align:left;padding:.5rem .75rem;font-weight:600;text-transform:uppercase;font-size:.7rem;letter-spacing:.05em}}
td{{padding:.5rem .75rem;border-bottom:1px solid #1e293b;color:#cbd5e1}}
.mono{{font-family:monospace}}
.small{{font-size:.75rem}}
tr:hover td{{background:#1e293b50}}
@media print{{body{{background:#fff;color:#1e293b}}.stat,.finding,.risk-gauge{{border:1px solid #e2e8f0}}th{{background:#f1f5f9}}}}
</style>
</head>
<body>
<div class="container">
<h1>🛡️ AD Security Assessment Report</h1>
<p class="meta">{domain} &middot; {dc_ip} &middot; Generated {ts}</p>

<div class="risk-gauge">
    <div class="risk-score" style="color:{_sev_color(risk_level)}">{risk_score}</div>
    <div>
        <div style="font-weight:700;color:{_sev_color(risk_level)};font-size:1.1rem">{risk_level} Risk</div>
        <div style="color:#64748b;font-size:.85rem">{len(findings)} findings &middot; {len(attack_paths)} attack paths</div>
    </div>
</div>

<div class="stats">
    <div class="stat"><div class="stat-val">{summary.get('total_users',0)}</div><div class="stat-lbl">Users</div></div>
    <div class="stat"><div class="stat-val">{summary.get('total_groups',0)}</div><div class="stat-lbl">Groups</div></div>
    <div class="stat"><div class="stat-val">{summary.get('total_computers',0)}</div><div class="stat-lbl">Computers</div></div>
    <div class="stat"><div class="stat-val">{summary.get('privileged_accounts',0)}</div><div class="stat-lbl">Privileged</div></div>
    <div class="stat"><div class="stat-val" style="color:#ef4444">{sev_counts.get('Critical',0)}</div><div class="stat-lbl">Critical</div></div>
    <div class="stat"><div class="stat-val" style="color:#f97316">{sev_counts.get('High',0)}</div><div class="stat-lbl">High</div></div>
</div>

<h2>Security Findings ({len(findings)})</h2>
{findings_html if findings_html else '<p style="color:#64748b">No findings detected.</p>'}

<h2>Attack Paths ({len(attack_paths)})</h2>
<table>
<thead><tr><th>#</th><th>Sev</th><th>Source</th><th>Target</th><th>Hops</th><th>MITRE</th><th>Description</th></tr></thead>
<tbody>{paths_html if paths_html else '<tr><td colspan="7" style="color:#64748b;text-align:center">No attack paths discovered.</td></tr>'}</tbody>
</table>

<div style="margin-top:3rem;padding-top:1rem;border-top:1px solid #1e293b;color:#475569;font-size:.75rem;text-align:center">
    AD Attack-Path Discovery Mapper &middot; Assessment generated automatically &middot; {ts}
</div>
</div>
</body>
</html>"""


def generate_json_report(session_data: Dict[str, Any]) -> Dict:
    """Generate a structured JSON report."""
    return {
        "report_type": "AD Security Assessment",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": session_data.get("summary", {}),
        "findings": session_data.get("findings", []),
        "attack_paths": session_data.get("attack_paths", []),
        "trusts": session_data.get("trusts", []),
        "password_policies": session_data.get("password_policies", []),
        "statistics": {
            "total_findings": len(session_data.get("findings", [])),
            "total_paths": len(session_data.get("attack_paths", [])),
            "total_users": len(session_data.get("users", [])),
            "total_groups": len(session_data.get("groups", [])),
            "total_computers": len(session_data.get("computers", [])),
        }
    }
