# AD Attack-Path Discovery Mapper

**Active Directory Security Analysis Dashboard — MARVEL.local**

A Windows-hosted, web-based security analysis dashboard for post-compromise AD reconnaissance. Performs LDAP-based enumeration, builds a permission graph, discovers privilege escalation attack paths, detects misconfigurations, and generates PowerShell remediation guidance with MITRE ATT&CK tagging.

---

## 🏗 Project Structure

```
Active Directory Path Discovery Mapper/
├── backend/
│   ├── main.py               # FastAPI application & REST API
│   ├── auth.py               # LDAPS authentication (port 636, NTLM)
│   ├── ldap_enum.py          # LDAP enumeration (users, groups, computers, ACLs)
│   ├── normalizer.py         # Data normalization & deduplication
│   ├── graph_builder.py      # NetworkX permission graph construction
│   ├── attack_paths.py       # BFS/DFS attack path discovery engine
│   ├── misconfig_detector.py # Misconfiguration detection module
│   ├── remediation.py        # PowerShell remediation generator
│   ├── mitre_mapping.py      # MITRE ATT&CK technique mapping
│   └── models.py             # Pydantic request/response models
├── frontend/
│   ├── index.html            # Dashboard shell
│   ├── css/style.css         # Dark glassmorphism UI
│   └── js/
│       ├── api.js            # API communication layer
│       ├── graph.js          # Cytoscape.js visualization
│       └── app.js            # Main application logic
├── sample_data/
│   └── marvel_sample.json    # Sample MARVEL.local test dataset
├── requirements.txt
└── README.md
```

---

## ⚙️ Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10+ |
| pip | Latest |
| Network access | To DC at `192.168.186.152` |
| LDAPS (port 636) | Must be enabled on DC |
| Valid domain account | Read access to AD is sufficient |

---

## 🚀 Setup & Run

### 1. Install Dependencies

```powershell
cd "C:\Active Directory Path Discovery Mapper"
pip install -r requirements.txt
```

### 2. Start the Backend

```powershell
cd "C:\Active Directory Path Discovery Mapper\backend"
python main.py
```

Server starts at: `http://localhost:8000`

### 3. Open the Dashboard

Open `frontend/index.html` in your browser, **or** navigate to:
```
http://localhost:8000
```

### 4. Connect to MARVEL.local

Fill in the login form:
- **DC IP:** `192.168.186.152`
- **Domain:** `MARVEL.local`  
- **Username:** Your domain account
- **Password:** Your domain password
- **LDAPS:** ✅ Enabled (port 636)

Click **Connect & Enumerate** — the system will authenticate, enumerate all AD objects, build the graph, and display results.

---

## 🔐 Security Design

| Principle | Implementation |
|---|---|
| Zero credential storage | Passwords cleared immediately after authentication |
| In-memory only | No database writes of credentials |
| LDAPS encryption | All AD communication over TLS (port 636) |
| Input validation | All API inputs sanitized against injection |
| Session-based | Session tokens never contain credentials |

---

## 📊 Dashboard Features

### 1. Domain Overview
- Total Users / Groups / Computers / Privileged Accounts
- Risk Score gauge (0–100)
- Domain Admins list
- Top 5 critical findings preview
- Quick search across all objects

### 2. Object Explorer
- Browse Users, Groups, Computers
- Filter/search objects
- Detailed view: memberships, permissions, SPNs
- Cross-references to related findings and attack paths

### 3. Attack Path Viewer
- Visual graph rendering via Cytoscape.js
- Step-by-step chain: `User → [MemberOf] → Group → [AdminTo] → DC`
- Severity classification (Critical / High / Medium / Low)
- Filter by severity and path type
- MITRE ATT&CK technique tags per path

### 4. Findings & Risk Panel
- Expandable finding cards
- Impact and description per finding
- Step-by-step remediation guidance
- Copy-ready PowerShell remediation commands
- MITRE ATT&CK tagging

---

## 🔍 Detection Coverage

| Category | Detections |
|---|---|
| **ACL Abuse** | GenericAll, WriteDACL, WriteOwner, GenericWrite |
| **Privilege Escalation** | User → Group → Domain Admin paths |
| **Lateral Movement** | AdminTo relationships, local admin rights |
| **Domain Admin Sprawl** | Excessive DA group membership |
| **Nested Group Abuse** | Over-privileged nested group chains |
| **Credential Risk** | Kerberoastable admin accounts, passwords never expire |

---

## 🛡 MITRE ATT&CK Coverage

| Technique | Name |
|---|---|
| T1078.002 | Valid Accounts: Domain Accounts |
| T1098 | Account Manipulation |
| T1069.002 | Permission Groups Discovery: Domain Groups |
| T1087.002 | Account Discovery: Domain Account |
| T1222 | File and Directory Permissions Modification |
| T1484 | Domain Policy Modification |
| T1558 | Steal or Forge Kerberos Tickets |
| T1021.002 | Remote Services: SMB/Windows Admin Shares |

---

## 🧪 Testing with Sample Data

A mock MARVEL.local dataset is provided in `sample_data/marvel_sample.json` with:
- 7 users (including Tony Stark, Natasha Romanoff, Peter Parker)
- 10 groups (Domain Admins, AVENGERS-IT, HelpDesk, etc.)
- 3 computers (DC, WORKSTATION01, WORKSTATION02)
- 4 ACL entries (WriteDACL, GenericAll, GenericWrite, WriteOwner)
- Intentional misconfigurations for demo purposes

---

## 🌐 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `POST /api/authenticate` | POST | Authenticate & enumerate |
| `GET /api/summary/{sid}` | GET | Domain overview summary |
| `GET /api/users/{sid}` | GET | All user objects |
| `GET /api/groups/{sid}` | GET | All group objects |
| `GET /api/computers/{sid}` | GET | All computer objects |
| `GET /api/attack-paths/{sid}` | GET | Attack paths with MITRE tags |
| `GET /api/findings/{sid}` | GET | Misconfigurations + remediation |
| `GET /api/graph/{sid}` | GET | Permission graph nodes/edges |
| `GET /api/object/{sid}/{name}` | GET | Single object detail |
| `POST /api/logout/{sid}` | POST | Clear session |

---

## ⚠️ Important Notes

- **This tool does NOT perform:** LLMNR poisoning, SMB relay, NTLM relay, or hash cracking
- **Starting assumption:** Valid domain credentials are already available ("Authenticated Domain Access Available")
- **LDAPS certificate:** The tool accepts self-signed certificates in lab environments
- **Scope:** Designed for small-to-medium AD environments (up to ~500 objects)
- **Platform:** Designed to run on Windows; tested with Python 3.11

---

## 📋 Lab Environment

| Component | Details |
|---|---|
| Domain Controller | Windows Server, `192.168.186.152` |
| Domain | `MARVEL.local` |
| Protocol | LDAPS, Port 636 |
| Users | 7 domain accounts |
| Groups | ~45 groups |
| Computers | 3 machines |
