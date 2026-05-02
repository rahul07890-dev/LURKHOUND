"""
Tests for remediation engine.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from remediation import enrich_findings_with_remediation


class TestRemediation:
    def test_enrichment_adds_remediation(self):
        findings = [{
            "finding_id": "EXCESSIVE_DA",
            "title": "Excessive Domain Admin Membership",
            "severity": "Critical",
            "description": "Too many domain admins",
            "affected": ["user1", "user2"],
        }]
        enriched = enrich_findings_with_remediation(findings, domain="TEST.local")
        assert len(enriched) == 1
        f = enriched[0]
        assert "remediation" in f or "remediation_steps" in f or "powershell" in f

    def test_enrichment_preserves_fields(self):
        findings = [{
            "finding_id": "UNKNOWN_FINDING",
            "title": "Unknown Test",
            "severity": "Low",
            "description": "Test finding",
            "affected": [],
        }]
        enriched = enrich_findings_with_remediation(findings, domain="TEST.local")
        assert enriched[0]["finding_id"] == "UNKNOWN_FINDING"
        assert enriched[0]["title"] == "Unknown Test"

    def test_empty_findings(self):
        enriched = enrich_findings_with_remediation([], domain="TEST.local")
        assert enriched == []

    def test_domain_parameterization(self):
        """Verify domain parameter is used instead of hardcoded MARVEL.local."""
        findings = [{
            "finding_id": "EXCESSIVE_DA",
            "title": "Excessive DA",
            "severity": "Critical",
            "description": "Test",
            "affected": ["admin1"],
        }]
        enriched = enrich_findings_with_remediation(findings, domain="CONTOSO.com")
        # If remediation contains PowerShell, it should reference CONTOSO.com
        for f in enriched:
            for key in ["remediation", "remediation_steps", "powershell", "powershell_commands"]:
                val = f.get(key, "")
                if isinstance(val, str) and "MARVEL" in val:
                    assert False, f"Found hardcoded MARVEL.local in {key}: {val}"
                if isinstance(val, list):
                    for item in val:
                        if isinstance(item, str) and "MARVEL" in item:
                            assert False, f"Found hardcoded MARVEL.local in list {key}"
