"""
Remediation Recommendation Generator
For each finding, generates:
- Clear explanation
- Configuration fix guidance
- PowerShell remediation command
- Risk reduction reasoning
"""
from typing import Dict, List, Any


REMEDIATION_TEMPLATES = {
    "generic_all_on_user": {
        "explanation": (
            "GenericAll grants complete control over an object — the ability to reset passwords, "
            "modify group memberships, write any attribute, and change permissions. "
            "This permission is almost never required for normal operations."
        ),
        "fix_guidance": (
            "1. Identify why this permission was granted (legacy configuration, misconfiguration, or intentional).\n"
            "2. Remove the GenericAll permission from the ACL of the affected object.\n"
            "3. Replace with the minimum required permission if any access is needed.\n"
            "4. Document the change in your change management system."
        ),
        "powershell": (
            "# Remove GenericAll from source principal on target object\n"
            "$target = Get-ADObject -Filter {{Name -eq '{target}'}}\n"
            "$sourceIdentity = Get-ADObject -Filter {{SamAccountName -eq '{source}'}}\n"
            "$acl = Get-Acl -Path \"AD:\\$($target.DistinguishedName)\"\n"
            "$ace = $acl.Access | Where-Object {{$_.IdentityReference -like \"*{source}*\" -and $_.ActiveDirectoryRights -eq \"GenericAll\"}}\n"
            "$acl.RemoveAccessRule($ace)\n"
            "Set-Acl -Path \"AD:\\$($target.DistinguishedName)\" -AclObject $acl\n"
            "Write-Host \"GenericAll removed from {source} on {target}\""
        ),
        "risk_reduction": (
            "Removes full object control. Prevents password reset attacks, "
            "group membership manipulation, and ACL modification by the source principal."
        )
    },
    "generic_all_on_group": {
        "explanation": (
            "GenericAll on a group allows the holder to add/remove members, reset the group's attributes, "
            "or even delete the group. On a privileged group like Domain Admins, this is catastrophic."
        ),
        "fix_guidance": (
            "1. Audit who granted this permission and why.\n"
            "2. Remove GenericAll from the group's ACL.\n"
            "3. If delegation is needed, use specific delegation (e.g., 'Manage group membership' only).\n"
            "4. Enable Advanced Audit Policy for DS Object Access on this group."
        ),
        "powershell": (
            "# Remove GenericAll from source on privileged group\n"
            "$group = Get-ADGroup -Identity '{target}'\n"
            "$acl = Get-Acl -Path \"AD:\\$($group.DistinguishedName)\"\n"
            "$ace = $acl.Access | Where-Object {{$_.IdentityReference -like \"*{source}*\" -and $_.ActiveDirectoryRights -match \"GenericAll\"}}\n"
            "$acl.RemoveAccessRule($ace)\n"
            "Set-Acl -Path \"AD:\\$($group.DistinguishedName)\" -AclObject $acl\n"
            "Write-Host \"GenericAll removed. Verify with: Get-ACL 'AD:\\{dn}'\""
        ),
        "risk_reduction": (
            "Eliminates the ability for the source account to add arbitrary users to privileged groups. "
            "Prevents a single account compromise from leading to domain admin."
        )
    },
    "write_dacl": {
        "explanation": (
            "WriteDACL allows a principal to modify the DACL (Access Control List) of an object. "
            "An attacker with WriteDACL can grant themselves GenericAll, effectively gaining full control."
        ),
        "fix_guidance": (
            "1. Remove WriteDACL from all non-administrative accounts.\n"
            "2. Only SYSTEM, Domain Admins, and Enterprise Admins should have WriteDACL on sensitive objects.\n"
            "3. Enable Protected Users security group for privileged accounts.\n"
            "4. Audit all DACL changes via Windows Security Event 4670."
        ),
        "powershell": (
            "# Remove WriteDACL permission\n"
            "$target = Get-ADObject -Filter {{Name -eq '{target}'}}\n"
            "$acl = Get-Acl -Path \"AD:\\$($target.DistinguishedName)\"\n"
            "$identity = [System.Security.Principal.NTAccount]\"{source}\"\n"
            "$adRight = [System.DirectoryServices.ActiveDirectoryRights]\"WriteDacl\"\n"
            "$type = [System.Security.AccessControl.AccessControlType]\"Allow\"\n"
            "$ace = New-Object System.DirectoryServices.ActiveDirectoryAccessRule $identity,$adRight,$type\n"
            "$acl.RemoveAccessRule($ace)\n"
            "Set-Acl -Path \"AD:\\$($target.DistinguishedName)\" -AclObject $acl"
        ),
        "risk_reduction": (
            "Prevents the source account from escalating its own privileges by rewriting the object's ACL. "
            "Eliminates a common privilege escalation vector in AD pen-tests."
        )
    },
    "write_owner": {
        "explanation": (
            "WriteOwner allows a principal to take ownership of an object. "
            "Once owned, the new owner can modify the object's DACL to grant any access rights."
        ),
        "fix_guidance": (
            "1. Remove WriteOwner from non-administrative accounts on sensitive objects.\n"
            "2. Verify object ownership using ADSI Edit.\n"
            "3. Reset object ownership to SYSTEM or Domain Admins if changed."
        ),
        "powershell": (
            "# Check and reset ownership of AD object\n"
            "$target = Get-ADObject -Filter {{Name -eq '{target}'}} -Properties nTSecurityDescriptor\n"
            "$acl = Get-Acl -Path \"AD:\\$($target.DistinguishedName)\"\n"
            "# Remove WriteOwner right\n"
            "$ace = $acl.Access | Where-Object {{$_.IdentityReference -like \"*{source}*\" -and $_.ActiveDirectoryRights -match \"WriteOwner\"}}\n"
            "$acl.RemoveAccessRule($ace)\n"
            "Set-Acl -Path \"AD:\\$($target.DistinguishedName)\" -AclObject $acl\n"
            "Write-Host \"WriteOwner removed from {source} on {target}\""
        ),
        "risk_reduction": (
            "Prevents ownership takeover chain attacks. Without WriteOwner, "
            "the source cannot silently restructure access to privileged objects."
        )
    },
    "excessive_admin_members": {
        "explanation": (
            "Domain Admins and Enterprise Admins groups should contain only essential accounts. "
            "Excessive membership increases the blast radius if any member account is compromised."
        ),
        "fix_guidance": (
            "1. Review all current Domain Admin members.\n"
            "2. Remove all service accounts, shared accounts, and non-essential users.\n"
            "3. Use Just-In-Time (JIT) privileged access — add to DA only when needed, remove after task.\n"
            "4. Enable MFA for all remaining admin accounts.\n"
            "5. Monitor Domain Admin group changes via Event ID 4728."
        ),
        "powershell": (
            "# Review Domain Admins members\n"
            "Get-ADGroupMember -Identity 'Domain Admins' -Recursive | Select Name, SamAccountName, objectClass\n\n"
            "# Remove a specific user from Domain Admins\n"
            "Remove-ADGroupMember -Identity 'Domain Admins' -Members '{source}' -Confirm:$false\n"
            "Write-Host \"Removed {source} from Domain Admins. Verify:\"\n"
            "Get-ADGroupMember -Identity 'Domain Admins' | Select Name"
        ),
        "risk_reduction": (
            "Reduces attack surface. Fewer admin accounts means fewer targets for credential theft "
            "and limits the impact of a single account compromise to full domain takeover."
        )
    },
    "nested_group_escalation": {
        "explanation": (
            "Nested group memberships cause users in outer groups to inherit all permissions "
            "of inner (nested) groups. This can grant unintended elevated access at scale."
        ),
        "fix_guidance": (
            "1. Audit all nested group memberships using Get-ADGroupMember -Recursive.\n"
            "2. Flatten group membership where possible.\n"
            "3. Remove privileged groups from general-purpose groups.\n"
            "4. Implement Role-Based Access Control (RBAC) with clearly scoped groups."
        ),
        "powershell": (
            "# View nested membership of a privileged group\n"
            "Get-ADGroupMember -Identity '{target}' -Recursive | Select Name, SamAccountName, objectClass\n\n"
            "# Remove a group from being nested in another\n"
            "Remove-ADGroupMember -Identity '{target}' -Members '{source}' -Confirm:$false\n"
            "Write-Host \"Removed nested membership of {source} in {target}\""
        ),
        "risk_reduction": (
            "Limits inherited privilege propagation. Prevents a compromise of one group "
            "from cascading privileges to unrelated user populations."
        )
    },
    "domain_admin_member": {
        "explanation": (
            "Privileged accounts with passwords set to never expire are persistent targets. "
            "If credentials are exposed in any form, they remain valid indefinitely."
        ),
        "fix_guidance": (
            "1. Enable password expiration for all privileged accounts.\n"
            "2. Implement a 90-day or shorter password policy for admin accounts.\n"
            "3. Consider using Managed Service Accounts (MSA) or Group MSAs where applicable.\n"
            "4. Implement MFA for all admin accounts."
        ),
        "powershell": (
            "# Enable password expiration for user\n"
            "Set-ADUser -Identity '{source}' -PasswordNeverExpires $false\n"
            "# Set a fine-grained password policy if needed\n"
            "# New-ADFineGrainedPasswordPolicy -Name 'AdminPSO' -Precedence 10 -MaxPasswordAge '90.00:00:00'\n"
            "Write-Host \"Password expiration enabled for {source}\""
        ),
        "risk_reduction": (
            "Reduces the window of exposure for compromised credentials. "
            "Regular rotation limits the usefulness of stolen passwords."
        )
    },
    "generic_write": {
        "explanation": (
            "GenericWrite allows writing to any non-protected attribute on an object. "
            "On user objects, this enables adding SPNs (Kerberoasting), setting logon scripts, "
            "or modifying shadow credentials."
        ),
        "fix_guidance": (
            "1. Remove GenericWrite from accounts that don't require it.\n"
            "2. Audit all objects with GenericWrite on privileged accounts.\n"
            "3. Monitor for unexpected SPN additions via Event ID 4769."
        ),
        "powershell": (
            "# Remove GenericWrite from source on target\n"
            "$target = Get-ADObject -Filter {{SamAccountName -eq '{target}'}}\n"
            "$acl = Get-Acl -Path \"AD:\\$($target.DistinguishedName)\"\n"
            "$ace = $acl.Access | Where-Object {{$_.IdentityReference -like \"*{source}*\" -and $_.ActiveDirectoryRights -match \"GenericWrite\"}}\n"
            "$acl.RemoveAccessRule($ace)\n"
            "Set-Acl -Path \"AD:\\$($target.DistinguishedName)\" -AclObject $acl"
        ),
        "risk_reduction": (
            "Prevents Kerberoasting via SPN injection, shadow credential attacks, "
            "and logon script manipulation through attribute writes."
        )
    },
    "acl_permission_abuse": {
        "explanation": (
            "Service accounts with SPNs set are vulnerable to Kerberoasting — "
            "an attack where TGS tickets are requested and cracked offline. "
            "Privileged accounts with SPNs are especially dangerous targets."
        ),
        "fix_guidance": (
            "1. Audit all accounts with SPNs set using setspn -T domain -Q */*\n"
            "2. Remove unnecessary SPNs from privileged accounts.\n"
            "3. Ensure all service accounts use Group Managed Service Accounts (gMSA) with auto-rotating passwords.\n"
            "4. Use 25+ character passwords for service accounts with SPNs."
        ),
        "powershell": (
            "# List all Kerberoastable accounts\n"
            "Get-ADUser -Filter {{ServicePrincipalName -ne '$null'}} -Properties ServicePrincipalName,adminCount | "
            "Where-Object {{$_.adminCount -eq 1}} | Select Name,SamAccountName,ServicePrincipalName\n\n"
            "# Remove SPN from an account (if not needed)\n"
            "Set-ADUser -Identity '{source}' -ServicePrincipalNames @{{Remove='HTTP/{source}.MARVEL.local'}}"
        ),
        "risk_reduction": (
            "Eliminates the ability to request offline-crackable tickets for privileged accounts. "
            "gMSA accounts make cracking infeasible due to automatic 120-character password rotation."
        )
    },
    "lateral_movement_risk": {
        "explanation": (
            "Local administrator rights on multiple machines allow an attacker to move laterally "
            "through the network using pass-the-hash or pass-the-ticket techniques."
        ),
        "fix_guidance": (
            "1. Deploy Microsoft LAPS (Local Administrator Password Solution) to randomize local admin passwords.\n"
            "2. Remove Domain Admins from local Administrators group on workstations.\n"
            "3. Implement tiered admin model (Tier 0/1/2).\n"
            "4. Monitor lateral movement via Event IDs 4624 (type 3), 4648, 4776."
        ),
        "powershell": (
            "# Install and configure LAPS\n"
            "# First install LAPS MSI from Microsoft\n"
            "Import-Module AdmPwd.PS\n"
            "Update-AdmPwdADSchema\n"
            "Set-AdmPwdComputerSelfPermission -OrgUnit '{target}'\n\n"
            "# View computers where user has admin rights via group\n"
            "Get-ADGroupMember -Identity 'Domain Admins' | Select SamAccountName"
        ),
        "risk_reduction": (
            "LAPS prevents lateral movement by ensuring each machine has a unique, "
            "randomly generated local admin password that changes automatically."
        )
    }
}

DEFAULT_REMEDIATION = {
    "explanation": "This permission or configuration represents an unnecessary privilege that increases security risk.",
    "fix_guidance": "Review the permission, assess if it is required, and remove it if not. Follow the principle of least privilege.",
    "powershell": "# Review Active Directory permissions\nGet-ACL -Path 'AD:\\{dn}' | Format-List",
    "risk_reduction": "Reducing unnecessary permissions limits the blast radius of any account compromise."
}


def generate_remediation(finding: Dict) -> Dict:
    """Generate a full remediation block for a given finding."""
    finding_type = finding.get('finding_type', '')
    template = REMEDIATION_TEMPLATES.get(finding_type, DEFAULT_REMEDIATION)

    # Get object names for PowerShell substitution
    affected = finding.get('affected_objects', [])
    source = affected[0] if len(affected) > 0 else 'SOURCE'
    target = affected[1] if len(affected) > 1 else 'TARGET'
    dn = f"CN={target},DC=MARVEL,DC=local"

    powershell = template['powershell'].replace('{source}', source).replace('{target}', target).replace('{dn}', dn)

    return {
        "explanation": template['explanation'],
        "fix_guidance": template['fix_guidance'],
        "powershell_fix": powershell,
        "risk_reduction": template['risk_reduction'],
    }


def enrich_findings_with_remediation(findings: List[Dict]) -> List[Dict]:
    """Add remediation data to each finding."""
    enriched = []
    for finding in findings:
        remediation = generate_remediation(finding)
        enriched_finding = {
            **finding,
            "remediation": remediation['fix_guidance'],
            "powershell_fix": remediation['powershell_fix'],
            "explanation": remediation['explanation'],
            "risk_reduction": remediation['risk_reduction'],
        }
        enriched.append(enriched_finding)
    return enriched
