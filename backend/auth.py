"""
LDAPS Authentication Module — MARVEL.local
Establishes LDAP/LDAPS connection to Domain Controller.
Credentials are NEVER stored; used only in-memory per session.

Auth strategy:
  1. Try NTLM (DOMAIN\\user) — may fail on OpenSSL 3.x (MD4 removed)
  2. Auto-fallback to SIMPLE (user@domain) — still encrypted over LDAPS/TLS
"""
import logging
import ssl
from typing import Optional, Tuple
from ldap3 import Server, Connection, ALL, NTLM, SIMPLE, Tls
from ldap3.core.exceptions import LDAPException, LDAPBindError, LDAPSocketOpenError

logger = logging.getLogger(__name__)


def build_server(dc_ip: str, use_ldaps: bool = True) -> Server:
    """Build the LDAP/LDAPS server object."""
    port = 636 if use_ldaps else 389
    if use_ldaps:
        tls = Tls(validate=ssl.CERT_NONE)  # Lab environment — skip self-signed cert validation
        server = Server(dc_ip, port=port, use_ssl=True, tls=tls, get_info=ALL)
    else:
        server = Server(dc_ip, port=port, get_info=ALL)
    return server


def _bind_ntlm(server: Server, domain: str, username: str, password: str) -> Tuple[bool, Optional[Connection], str]:
    """Attempt NTLM authentication (DOMAIN\\username)."""
    user_str = f"{domain}\\{username}"
    conn = Connection(
        server,
        user=user_str,
        password=password,
        authentication=NTLM,
        auto_bind=False,
        receive_timeout=30
    )
    if conn.bind():
        logger.info(f"NTLM auth successful for {user_str}")
        return True, conn, "Authentication successful (NTLM)"
    return False, None, f"NTLM bind failed: {conn.result.get('description', 'Invalid credentials')}"


def _bind_simple(server: Server, domain: str, username: str, password: str) -> Tuple[bool, Optional[Connection], str]:
    """Attempt SIMPLE authentication (username@domain) — secure when using LDAPS."""
    # Try UPN format first, then plain username
    for user_str in [f"{username}@{domain}", username]:
        try:
            conn = Connection(
                server,
                user=user_str,
                password=password,
                authentication=SIMPLE,
                auto_bind=False,
                receive_timeout=30
            )
            if conn.bind():
                logger.info(f"SIMPLE auth successful for {user_str}")
                return True, conn, "Authentication successful (SIMPLE/TLS)"
        except Exception:
            continue
    return False, None, "SIMPLE bind failed: Invalid credentials or account locked"


def authenticate(
    dc_ip: str,
    username: str,
    password: str,
    domain: str,
    use_ldaps: bool = True
) -> Tuple[bool, Optional[Connection], str]:
    """
    Authenticate to Active Directory via LDAP/LDAPS.

    Tries NTLM first; falls back to SIMPLE if NTLM fails due to
    OpenSSL 3.x / Python 3.11+ removing the MD4 hash (used by NTLMv1).
    SIMPLE auth is still fully encrypted when use_ldaps=True.

    Returns:
        (success: bool, connection: Optional[Connection], message: str)
    Passwords are NOT persisted.
    """
    try:
        server = build_server(dc_ip, use_ldaps)

        # ── Attempt 1: NTLM ──────────────────────────────────────────
        try:
            ok, conn, msg = _bind_ntlm(server, domain, username, password)
            if ok:
                password = None  # noqa — clear immediately
                return True, conn, msg
            # If NTLM returned a definitive "invalid credentials" don't bother falling back
            if "invalidCredentials" in msg or "Invalid credentials" in msg:
                return False, None, "Authentication failed: Invalid credentials"
        except Exception as e:
            err = str(e).lower()
            if "md4" in err or "unsupported hash" in err or "unknown message digest" in err:
                logger.warning("NTLM blocked by OpenSSL (MD4 removed) — falling back to SIMPLE/TLS")
            elif "invalidcredentials" in err or "invalid credentials" in err:
                return False, None, "Authentication failed: Invalid credentials"
            else:
                logger.warning(f"NTLM failed ({e}), trying SIMPLE fallback")

        # ── Attempt 2: SIMPLE over LDAPS (TLS-encrypted) ─────────────
        ok, conn, msg = _bind_simple(server, domain, username, password)
        password = None  # noqa
        if ok:
            return True, conn, msg
        return False, None, msg

    except LDAPBindError as e:
        return False, None, f"Invalid credentials: {str(e)}"
    except LDAPSocketOpenError as e:
        return False, None, (
            f"Cannot connect to {dc_ip}:{636 if use_ldaps else 389}. "
            f"Ensure the DC is reachable and LDAPS is enabled. Error: {str(e)}"
        )
    except LDAPException as e:
        return False, None, f"LDAP error: {str(e)}"
    except Exception as e:
        return False, None, f"Unexpected error: {str(e)}"
    finally:
        password = None  # noqa — belt-and-suspenders clear


def get_base_dn(domain: str) -> str:
    """Convert domain name to LDAP base DN. e.g., MARVEL.local -> DC=MARVEL,DC=local"""
    parts = domain.split(".")
    return ",".join(f"DC={part}" for part in parts)


def close_connection(conn: Optional[Connection]):
    """Safely close the LDAP connection."""
    if conn and conn.bound:
        try:
            conn.unbind()
        except Exception:
            pass
