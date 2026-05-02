"""
Pytest fixtures for LURKHOUND test suite.
Provides mock AD data and graph objects for unit testing.
"""
import sys
import os
import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


@pytest.fixture
def mock_users():
    """Mock AD user objects for testing."""
    return [
        {
            "dn": "CN=Tony Stark,OU=Users,DC=MARVEL,DC=local",
            "sam_account_name": "tstark",
            "display_name": "Tony Stark",
            "object_type": "User",
            "attributes": {"is_admin": True, "enabled": True},
            "spn_list": [],
            "member_of": ["CN=Domain Admins,CN=Users,DC=MARVEL,DC=local"],
        },
        {
            "dn": "CN=Peter Parker,OU=Users,DC=MARVEL,DC=local",
            "sam_account_name": "pparker",
            "display_name": "Peter Parker",
            "object_type": "User",
            "attributes": {"is_admin": False, "enabled": True},
            "spn_list": ["MSSQLSvc/webserver.MARVEL.local:1433"],
            "member_of": ["CN=HelpDesk,OU=Groups,DC=MARVEL,DC=local"],
        },
        {
            "dn": "CN=Natasha Romanoff,OU=Users,DC=MARVEL,DC=local",
            "sam_account_name": "nromanoff",
            "display_name": "Natasha Romanoff",
            "object_type": "User",
            "attributes": {"is_admin": False, "enabled": True, "password_never_expires": True},
            "spn_list": [],
            "member_of": [],
        },
    ]


@pytest.fixture
def mock_groups():
    """Mock AD group objects for testing."""
    return [
        {
            "dn": "CN=Domain Admins,CN=Users,DC=MARVEL,DC=local",
            "sam_account_name": "Domain Admins",
            "object_type": "Group",
            "members": ["CN=Tony Stark,OU=Users,DC=MARVEL,DC=local"],
        },
        {
            "dn": "CN=HelpDesk,OU=Groups,DC=MARVEL,DC=local",
            "sam_account_name": "HelpDesk",
            "object_type": "Group",
            "members": ["CN=Peter Parker,OU=Users,DC=MARVEL,DC=local"],
        },
    ]


@pytest.fixture
def mock_computers():
    """Mock AD computer objects for testing."""
    return [
        {
            "dn": "CN=DC01,OU=Domain Controllers,DC=MARVEL,DC=local",
            "sam_account_name": "DC01$",
            "object_type": "Computer",
            "attributes": {"is_dc": True},
        },
    ]


@pytest.fixture
def mock_normalized(mock_users, mock_groups, mock_computers):
    """Complete normalized dataset."""
    return {
        "users": mock_users,
        "groups": mock_groups,
        "computers": mock_computers,
        "acls": [
            {
                "source_dn": "CN=HelpDesk,OU=Groups,DC=MARVEL,DC=local",
                "target_dn": "CN=Domain Admins,CN=Users,DC=MARVEL,DC=local",
                "right": "GenericAll",
            }
        ],
        "gpos": [],
        "ous": [],
        "trusts": [],
        "password_policies": [],
    }
