"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class AuthRequest(BaseModel):
    dc_ip: str = Field(..., description="Domain Controller IP address")
    username: str = Field(..., description="Domain username (without domain prefix)")
    password: str = Field(..., description="Domain password")
    domain: str = Field(default="MARVEL.local", description="AD domain name")
    use_ldaps: bool = Field(default=True, description="Use LDAPS (636) instead of LDAP (389)")

    class Config:
        json_schema_extra = {
            "example": {
                "dc_ip": "192.168.186.152",
                "username": "administrator",
                "password": "Password123!",
                "domain": "MARVEL.local",
                "use_ldaps": True
            }
        }


class ADObject(BaseModel):
    dn: str
    sam_account_name: Optional[str] = None
    object_type: str  # User, Group, Computer
    sid: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    member_of: List[str] = []
    members: List[str] = []
    attributes: Dict[str, Any] = {}


class ACLEntry(BaseModel):
    source: str
    target: str
    permission: str  # GenericAll, WriteDACL, WriteOwner, GenericWrite, etc.
    source_type: str
    target_type: str


class AttackPath(BaseModel):
    path: List[str]
    edges: List[Dict[str, str]]
    severity: str
    description: str
    mitre_techniques: List[Dict[str, str]] = []
    length: int


class Finding(BaseModel):
    id: str
    title: str
    description: str
    impact: str
    severity: str  # Low, Medium, High, Critical
    affected_objects: List[str]
    remediation: str
    powershell_fix: str
    mitre_techniques: List[Dict[str, str]] = []


class DomainSummary(BaseModel):
    total_users: int
    total_groups: int
    total_computers: int
    privileged_accounts: int
    domain_admins: List[str]
    attack_paths_found: int
    findings_count: int
    risk_score: int  # 0-100
    risk_level: str  # Low / Medium / High / Critical


class EnumerationResult(BaseModel):
    users: List[ADObject]
    groups: List[ADObject]
    computers: List[ADObject]
    acls: List[ACLEntry]
    summary: DomainSummary
    attack_paths: List[AttackPath]
    findings: List[Finding]
