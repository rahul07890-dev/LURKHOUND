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
    },
    "asrep_roastable": {
        "explanation": (
            "Accounts with Kerberos pre-authentication disabled are vulnerable to AS-REP Roasting. "
            "An attacker can request an AS-REP for these accounts without knowing the password, "
            "then crack the encrypted portion offline to recover the plaintext password."
        ),
        "fix_guidance": (
            "1. Enable Kerberos pre-authentication for all user accounts.\n"
            "2. Audit which accounts have 'Do not require Kerberos preauthentication' checked.\n"
            "3. If pre-auth must remain disabled (rare), enforce a 25+ character password.\n"
            "4. Monitor for Event ID 4768 with preauth type 0."
        ),
        "powershell": (
            "# List all AS-REP Roastable accounts\n"
            "Get-ADUser -Filter {{DoesNotRequirePreAuth -eq $true}} -Properties DoesNotRequirePreAuth |\n"
            "  Select Name, SamAccountName, DoesNotRequirePreAuth\n\n"
            "# Enable pre-authentication for a specific account\n"
            "Set-ADAccountControl -Identity '{source}' -DoesNotRequirePreAuth $false\n"
            "Write-Host \"Pre-authentication enabled for {source}\""
        ),
        "risk_reduction": (
            "Eliminates the ability to request offline-crackable AS-REP tickets. "
            "With pre-auth enabled, an attacker must know the password to request a TGT."
        )
    },
    "weak_password_policy": {
        "explanation": (
            "The domain password policy does not meet security best practices. "
            "Weak password policies allow users to choose short or simple passwords "
            "that are easily cracked via brute force or dictionary attacks."
        ),
        "fix_guidance": (
            "1. Set minimum password length to 14+ characters.\n"
            "2. Enable password complexity requirements.\n"
            "3. Set maximum password age to 90 days or less.\n"
            "4. Configure account lockout after 5 failed attempts.\n"
            "5. Consider implementing Fine-Grained Password Policies (FGPP) for privileged accounts."
        ),
        "powershell": (
            "# View current domain password policy\n"
            "Get-ADDefaultDomainPasswordPolicy | Select MinPasswordLength, MaxPasswordAge, "
            "ComplexityEnabled, LockoutThreshold, PasswordHistoryCount\n\n"
            "# Set a stronger policy\n"
            "Set-ADDefaultDomainPasswordPolicy -Identity '{target}' "
            "-MinPasswordLength 14 -ComplexityEnabled $true "
            "-MaxPasswordAge '90.00:00:00' -LockoutThreshold 5 "
            "-LockoutDuration '00:30:00' -LockoutObservationWindow '00:30:00'"
        ),
        "risk_reduction": (
            "Strong password policies make brute-force and dictionary attacks infeasible. "
            "A 14-character complex password takes centuries to crack with current hardware."
        )
    },
    "stale_computer": {
        "explanation": (
            "Computer accounts that have not authenticated to the domain in over 90 days "
            "may be abandoned or decommissioned machines. These stale accounts can be abused "
            "for domain persistence or to impersonate legitimate systems."
        ),
        "fix_guidance": (
            "1. Identify all computer accounts with no recent logon activity.\n"
            "2. Verify with system administrators whether machines are still in use.\n"
            "3. Disable stale computer accounts first (30-day quarantine).\n"
            "4. Delete confirmed decommissioned accounts after the quarantine period.\n"
            "5. Implement automated cleanup via scheduled scripts."
        ),
        "powershell": (
            "# Find computers not logged on in 90+ days\n"
            "$threshold = (Get-Date).AddDays(-90)\n"
            "Get-ADComputer -Filter {{LastLogonDate -lt $threshold}} "
            "-Properties LastLogonDate, OperatingSystem |\n"
            "  Select Name, LastLogonDate, OperatingSystem, Enabled |\n"
            "  Sort LastLogonDate\n\n"
            "# Disable a stale computer account\n"
            "Disable-ADAccount -Identity '{source}$'\n"
            "Write-Host \"Disabled stale computer account: {source}\""
        ),
        "risk_reduction": (
            "Removes orphaned machine identities that attackers can leverage for "
            "domain persistence, lateral movement, or Kerberos ticket abuse."
        )
    },
    "stale_disabled_member": {
        "explanation": (
            "Disabled user accounts that remain members of security groups (especially "
            "privileged groups) represent a hygiene issue. If a disabled account is "
            "accidentally re-enabled, it immediately inherits all group permissions."
        ),
        "fix_guidance": (
            "1. Remove disabled accounts from all security groups.\n"
            "2. Move disabled accounts to a dedicated 'Disabled Users' OU.\n"
            "3. Implement an automated offboarding process that strips group memberships.\n"
            "4. Review disabled accounts quarterly for deletion eligibility."
        ),
        "powershell": (
            "# Find disabled users still in groups\n"
            "Get-ADUser -Filter {{Enabled -eq $false}} -Properties MemberOf |\n"
            "  Where-Object {{$_.MemberOf.Count -gt 0}} |\n"
            "  Select Name, SamAccountName, @{{N='Groups';E={{$_.MemberOf.Count}}}}\n\n"
            "# Remove a disabled user from all groups\n"
            "$user = Get-ADUser '{source}' -Properties MemberOf\n"
            "$user.MemberOf | ForEach-Object {{ Remove-ADGroupMember -Identity $_ -Members '{source}' -Confirm:$false }}\n"
            "Write-Host \"Removed {source} from all groups\""
        ),
        "risk_reduction": (
            "Prevents accidental privilege restoration if a disabled account is re-enabled. "
            "Clean group memberships enforce the principle of least privilege."
        )
    },
    "empty_security_group": {
        "explanation": (
            "Security groups with zero members serve no access control purpose but add "
            "complexity to the directory. They may indicate abandoned projects or "
            "misconfigured delegation, and can be confusing during security audits."
        ),
        "fix_guidance": (
            "1. Review each empty security group to determine its intended purpose.\n"
            "2. Consult with application owners before deletion.\n"
            "3. Delete confirmed unnecessary groups.\n"
            "4. Convert groups that are intentionally empty (placeholders) to distribution groups if applicable."
        ),
        "powershell": (
            "# Find empty security groups\n"
            "Get-ADGroup -Filter {{GroupCategory -eq 'Security'}} -Properties Members |\n"
            "  Where-Object {{$_.Members.Count -eq 0}} |\n"
            "  Select Name, SamAccountName, GroupScope, DistinguishedName\n\n"
            "# Remove an empty group after verification\n"
            "Remove-ADGroup -Identity '{source}' -Confirm:$false\n"
            "Write-Host \"Removed empty security group: {source}\""
        ),
        "risk_reduction": (
            "Reduces directory complexity and eliminates potential targets for "
            "group membership injection attacks via ACL abuse."
        )
    },
    "shadow_admin": {
        "explanation": (
            "Shadow admins are non-admin accounts that have indirect administrative control "
            "via ACL permissions (GenericAll, WriteDACL, WriteOwner) on privileged groups or "
            "user objects. These accounts bypass normal admin auditing and monitoring."
        ),
        "fix_guidance": (
            "1. Identify all accounts with write permissions on privileged groups/users.\n"
            "2. Remove unnecessary ACL entries granting indirect admin control.\n"
            "3. Add identified shadow admins to the AdminSDHolder protected group if they must retain access.\n"
            "4. Monitor shadow admin accounts with the same rigor as Domain Admins."
        ),
        "powershell": (
            "# Audit ACLs on Domain Admins group for shadow admin detection\n"
            "$da = Get-ADGroup 'Domain Admins'\n"
            "$acl = Get-Acl \"AD:\\$($da.DistinguishedName)\"\n"
            "$acl.Access | Where-Object {{\n"
            "  $_.ActiveDirectoryRights -match 'GenericAll|WriteDacl|WriteOwner' -and\n"
            "  $_.IdentityReference -notmatch 'SYSTEM|Domain Admins|Enterprise Admins'\n"
            "}} | Select IdentityReference, ActiveDirectoryRights, AccessControlType\n\n"
            "# Remove a shadow admin ACE\n"
            "$ace = $acl.Access | Where-Object {{$_.IdentityReference -like '*{source}*'}}\n"
            "$acl.RemoveAccessRule($ace)\n"
            "Set-Acl \"AD:\\$($da.DistinguishedName)\" $acl"
        ),
        "risk_reduction": (
            "Eliminates hidden administrative backdoors. Shadow admins are frequently "
            "missed during security reviews but grant equivalent access to Domain Admins."
        )
    },
    "trust_no_sid_filtering": {
        "explanation": (
            "SID filtering is a security boundary that prevents SID History injection "
            "across trust boundaries. When disabled, an attacker who compromises the trusted "
            "domain can inject arbitrary SIDs (e.g., Enterprise Admins) into their token."
        ),
        "fix_guidance": (
            "1. Enable SID filtering (quarantine) on all external and forest trusts.\n"
            "2. Review trust relationships using netdom trust /domain.\n"
            "3. Only disable SID filtering when absolutely required for migrations.\n"
            "4. Re-enable SID filtering immediately after migration completes."
        ),
        "powershell": (
            "# Check SID filtering status on a trust\n"
            "netdom trust {source} /domain:{target} /quarantine\n\n"
            "# Enable SID filtering (quarantine)\n"
            "netdom trust {source} /domain:{target} /quarantine:yes\n"
            "Write-Host \"SID filtering enabled on trust to {target}\"\n\n"
            "# Verify the change\n"
            "netdom trust {source} /domain:{target} /quarantine"
        ),
        "risk_reduction": (
            "Restores the security boundary between trusted domains. "
            "Prevents cross-domain privilege escalation via SID History injection attacks."
        )
    },
}

DEFAULT_REMEDIATION = {
    "explanation": "This permission or configuration represents an unnecessary privilege that increases security risk.",
    "fix_guidance": "Review the permission, assess if it is required, and remove it if not. Follow the principle of least privilege.",
    "powershell": "# Review Active Directory permissions\nGet-ACL -Path 'AD:\\{dn}' | Format-List",
    "risk_reduction": "Reducing unnecessary permissions limits the blast radius of any account compromise."
}


def generate_remediation(finding: Dict, domain: str = "DOMAIN.local") -> Dict:
    """Generate a full remediation block for a given finding."""
    finding_type = finding.get('finding_type', '')
    template = REMEDIATION_TEMPLATES.get(finding_type, DEFAULT_REMEDIATION)

    # Get object names for PowerShell substitution
    affected = finding.get('affected_objects', [])
    source = affected[0] if len(affected) > 0 else 'SOURCE'
    target = affected[1] if len(affected) > 1 else 'TARGET'

    # Build DN dynamically from domain parameter instead of hardcoding
    dc_parts = ",".join(f"DC={part}" for part in domain.split("."))
    dn = f"CN={target},{dc_parts}"

    powershell = template['powershell'].replace('{source}', source).replace('{target}', target).replace('{dn}', dn)

    return {
        "explanation": template['explanation'],
        "fix_guidance": template['fix_guidance'],
        "powershell_fix": powershell,
        "risk_reduction": template['risk_reduction'],
    }


def enrich_findings_with_remediation(findings: List[Dict], domain: str = "DOMAIN.local") -> List[Dict]:
    """Add remediation data to each finding."""
    enriched = []
    for finding in findings:
        remediation = generate_remediation(finding, domain=domain)
        enriched_finding = {
            **finding,
            "remediation": remediation['fix_guidance'],
            "powershell_fix": remediation['powershell_fix'],
            "explanation": remediation['explanation'],
            "risk_reduction": remediation['risk_reduction'],
        }
        enriched.append(enriched_finding)
    return enriched

