"""
Risk Score Calculator — extracted from main.py to avoid duplication.
"""
import math


def calculate_risk_score(findings: list, attack_paths: list, users: list, domain_admins: list) -> tuple:
    """
    Calculate a weighted risk score (0–100) and risk level string.
    Returns (risk_score: int, risk_level: str).
    """
    critical_count = sum(1 for f in findings if f.get('severity') == 'Critical')
    high_count = sum(1 for f in findings if f.get('severity') == 'High')
    medium_count = sum(1 for f in findings if f.get('severity') == 'Medium')
    path_count = len(attack_paths)

    # Component scores (each 0-100)
    crit_score = min(100, critical_count * 35)
    finding_score = min(100, high_count * 15 + medium_count * 5)
    path_score = min(100, int(30 * math.log1p(path_count))) if path_count else 0

    priv_count = len([u for u in users if u.get('attributes', {}).get('is_admin')])
    da_count = len(domain_admins)
    priv_score = min(100, da_count * 20 + priv_count * 10)

    # Weighted final score
    # Weights: critical findings 40%, high/med findings 20%, paths 25%, privilege 15%
    risk_score = int(
        crit_score * 0.40 +
        finding_score * 0.20 +
        path_score * 0.25 +
        priv_score * 0.15
    )
    risk_score = max(0, min(100, risk_score))
    risk_level = (
        "Critical" if risk_score >= 75
        else "High" if risk_score >= 50
        else "Medium" if risk_score >= 25
        else "Low"
    )

    return risk_score, risk_level
