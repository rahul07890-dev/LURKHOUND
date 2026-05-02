"""
Tests for risk scoring engine.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from risk import calculate_risk_score


class TestRiskScore:
    def test_zero_findings_low_risk(self):
        score, level = calculate_risk_score([], [], [], [])
        assert score == 0 or level == "Low"

    def test_critical_findings_increase_score(self):
        findings = [
            {"severity": "Critical", "finding_id": "F1"},
            {"severity": "Critical", "finding_id": "F2"},
            {"severity": "High", "finding_id": "F3"},
        ]
        paths = [{"severity": "Critical"}]
        users = [{"sam_account_name": "user1"}, {"sam_account_name": "user2"}]
        admins = ["user1"]
        score, level = calculate_risk_score(findings, paths, users, admins)
        assert score > 0
        assert level in ["Low", "Medium", "High", "Critical"]

    def test_many_admins_high_risk(self):
        """More domain admins relative to users should increase risk."""
        findings = [{"severity": "High", "finding_id": "F1"}]
        paths = []
        users = [{"sam_account_name": f"user{i}"} for i in range(5)]
        admins = [f"user{i}" for i in range(4)]  # 4 out of 5 users are DA
        score, level = calculate_risk_score(findings, paths, users, admins)
        assert score > 10  # Should be elevated

    def test_score_bounded(self):
        """Score should be between 0 and 100."""
        findings = [{"severity": "Critical", "finding_id": f"F{i}"} for i in range(50)]
        paths = [{"severity": "Critical"} for _ in range(20)]
        users = [{"sam_account_name": f"u{i}"} for i in range(100)]
        admins = [f"u{i}" for i in range(50)]
        score, level = calculate_risk_score(findings, paths, users, admins)
        assert 0 <= score <= 100
