<p align="center">
  <img src="https://img.shields.io/badge/python-3.10%2B-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

# 🐾 LURKHOUND

**Active Directory Attack-Path Discovery Mapper**

A Windows-hosted, web-based security analysis dashboard for post-compromise AD reconnaissance. LURKHOUND performs LDAP-based enumeration, builds a permission graph, discovers privilege escalation attack paths, detects misconfigurations, and generates PowerShell remediation guidance — all tagged with MITRE ATT&CK techniques.

---

## ✨ Key Features

- 🔍 **LDAP Enumeration** — Users, groups, computers, OUs, and ACLs via LDAPS (port 636)
- 🕸️ **Attack Path Discovery** — BFS/DFS engine finds privilege escalation chains to Domain Admin
- 🛡️ **Misconfiguration Detection** — ACL abuse, DA sprawl, Kerberoastable accounts, nested group abuse
- 📊 **Interactive Dashboard** — Dark glassmorphism UI with risk gauges, graphs, and real-time search
- 🗺️ **Graph Visualization** — Cytoscape.js-powered permission graph with severity-colored nodes
- 🩺 **Remediation Engine** — Copy-ready PowerShell commands for every finding
- 🎯 **MITRE ATT&CK Mapping** — Every finding and attack path tagged with technique IDs
- 📜 **Scan History** — Track and compare enumeration results over time
- 📥 **BloodHound Import** — Ingest BloodHound JSON exports for analysis

---

## 🏗 Project Structure

```
LURKHOUND/
├── backend/
│   ├── main.py                # FastAPI application & REST API
│   ├── config.py              # Environment config loader (.env)
│   ├── auth.py                # LDAPS authentication (port 636, NTLM)
│   ├── ldap_enum.py           # LDAP enumeration (users, groups, computers, ACLs)
│   ├── normalizer.py          # Data normalization & deduplication
│   ├── graph_builder.py       # NetworkX permission graph construction
│   ├── attack_paths.py        # BFS/DFS attack path discovery engine
│   ├── misconfig_detector.py  # Misconfiguration detection module
│   ├── risk.py                # Risk score calculation engine
│   ├── remediation.py         # PowerShell remediation generator
│   ├── mitre_mapping.py       # MITRE ATT&CK technique mapping
│   ├── bloodhound_io.py       # BloodHound JSON import/export
│   ├── report_generator.py    # PDF/HTML report generation
│   ├── scan_history.py        # Scan history tracking (SQLite)
│   └── models.py              # Pydantic request/response models
│
├── frontend-next/             # Primary UI (Next.js + TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing / login page
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── globals.css           # Global styles
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx        # Dashboard shell with sidebar
│   │   │       ├── overview/         # Domain overview & risk score
│   │   │       ├── objects/          # Object explorer (users/groups/computers)
│   │   │       ├── paths/            # Attack path viewer
│   │   │       ├── graph/            # Permission graph visualization
│   │   │       ├── findings/         # Findings & remediation panel
│   │   │       ├── ou-tree/          # OU tree view
│   │   │       └── history/          # Scan history & comparisons
│   │   ├── components/
│   │   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   │   ├── SearchModal.tsx       # Global search (Ctrl+K)
│   │   │   ├── ObjectDrawer.tsx      # Object detail slide-out drawer
│   │   │   ├── NotificationBell.tsx  # Real-time notifications
│   │   │   ├── OnboardingTour.tsx    # First-run guided tour
│   │   │   ├── AboutModal.tsx        # About / credits modal
│   │   │   ├── PantherIcon.tsx       # LURKHOUND branding icon
│   │   │   ├── ErrorBoundary.tsx     # Error handling wrapper
│   │   │   ├── SkeletonLoader.tsx    # Loading state skeletons
│   │   │   └── Toast.tsx             # Toast notifications
│   │   ├── context/
│   │   │   └── SessionContext.tsx    # Session state management
│   │   ├── lib/
│   │   │   └── api.ts               # API client layer
│   │   └── types/
│   │       └── index.ts             # TypeScript type definitions
│   ├── tailwind.config.js
│   ├── next.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                  # Legacy UI (HTML/CSS/JS)
│   ├── index.html             # Dashboard shell
│   ├── css/style.css          # Dark glassmorphism theme
│   └── js/
│       ├── api.js             # API communication layer
│       ├── graph.js           # Cytoscape.js visualization
│       └── app.js             # Main application logic
│
├── sample_data/
│   └── marvel_sample.json     # Sample MARVEL.local test dataset
│
├── data/                      # Runtime data (gitignored)
│   └── scan_history.db        # SQLite scan history database
│
├── .env                       # Environment config (gitignored)
├── .gitignore
├── requirements.txt           # Python dependencies
├── start.bat                  # Windows launcher (CMD)
├── start.ps1                  # Windows launcher (PowerShell)
└── README.md
```

---

## ⚙️ Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ (for Next.js frontend) |
| pip | Latest |
| Network access | To your Domain Controller |
| LDAPS (port 636) | Must be enabled on DC |
| Valid domain account | Read access to AD is sufficient |

---

## 🚀 Setup & Run

### Option A: Quick Start (Recommended)

Use the included launcher script:

```powershell
# PowerShell
.\start.ps1
```

```batch
:: CMD
start.bat
```

This will install dependencies, start the backend API, and launch the Next.js frontend automatically.

### Option B: Manual Setup

#### 1. Install Python Dependencies

```powershell
cd LURKHOUND
pip install -r requirements.txt
```

#### 2. Install Frontend Dependencies

```powershell
cd frontend-next
npm install
```

#### 3. Configure Environment

Create a `.env` file in the project root (see `.env.example`):

```env
API_PORT=8000
LOG_LEVEL=info
SESSION_TTL_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000
```

#### 4. Start the Backend

```powershell
cd backend
python main.py
```

Server starts at `http://localhost:8000`

#### 5. Start the Frontend

```powershell
cd frontend-next
npm run dev
```

Dashboard opens at `http://localhost:3000`

### 6. Connect to Your Domain

Fill in the login form:
- **DC IP:** Your domain controller IP
- **Domain:** Your AD domain (e.g., `MARVEL.local`)
- **Username:** Domain account with read access
- **Password:** Domain account password
- **LDAPS:** ✅ Enabled (port 636)

Click **Connect & Enumerate** — the system will authenticate, enumerate all AD objects, build the permission graph, and display results.

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

## 📊 Dashboard Pages

### 1. Domain Overview
- Total Users / Groups / Computers / Privileged Accounts
- Risk Score gauge (0–100)
- Domain Admins list
- Risk trend chart over time
- Top 5 critical findings preview
- Quick search across all objects

### 2. Object Explorer
- Browse Users, Groups, Computers
- Filter and search objects
- Detailed view: memberships, permissions, SPNs
- Slide-out drawer with cross-references to findings and attack paths

### 3. Attack Path Viewer
- Visual graph rendering via Cytoscape.js
- Step-by-step chain: `User → [MemberOf] → Group → [AdminTo] → DC`
- Severity classification (Critical / High / Medium / Low)
- Filter by severity and path type
- MITRE ATT&CK technique tags per path

### 4. Permission Graph
- Full interactive permission graph
- Severity-colored nodes and edges
- Zoom, pan, and node selection
- Orphan node filtering

### 5. Findings & Remediation
- Expandable finding cards with severity badges
- Impact and description per finding
- Step-by-step remediation guidance
- Copy-ready PowerShell remediation commands
- MITRE ATT&CK tagging

### 6. OU Tree View
- Hierarchical Organizational Unit browser
- Collapse/expand OU branches
- Object counts per OU

### 7. Scan History
- Historical scan results comparison
- Track changes in risk score over time
- Side-by-side diff between scans

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

You can also import BloodHound JSON exports via the `/api/bloodhound/import` endpoint.

---

## 🌐 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/authenticate` | POST | Authenticate & enumerate AD |
| `/api/summary/{sid}` | GET | Domain overview summary |
| `/api/users/{sid}` | GET | All user objects |
| `/api/groups/{sid}` | GET | All group objects |
| `/api/computers/{sid}` | GET | All computer objects |
| `/api/attack-paths/{sid}` | GET | Attack paths with MITRE tags |
| `/api/findings/{sid}` | GET | Misconfigurations + remediation |
| `/api/graph/{sid}` | GET | Permission graph (nodes/edges) |
| `/api/object/{sid}/{name}` | GET | Single object detail |
| `/api/scan-history` | GET | List all scan records |
| `/api/bloodhound/import` | POST | Import BloodHound JSON |
| `/api/logout/{sid}` | POST | Clear session |

---

## 🏛️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Next.js Frontend  (TypeScript + Tailwind CSS)      │ │
│  │  ── Landing Page ── Dashboard ── Graph Viewer ──    │ │
│  └────────────────────────┬────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────┘
                            │ REST API (JSON)
┌───────────────────────────┼──────────────────────────────┐
│                    FastAPI Backend                        │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │  auth.py   │  │  ldap_enum.py  │  │ normalizer.py │  │
│  └─────┬──────┘  └───────┬────────┘  └──────┬────────┘  │
│        │                 │                   │           │
│  ┌─────▼─────────────────▼───────────────────▼────────┐  │
│  │              graph_builder.py (NetworkX)            │  │
│  └─────────────────────┬──────────────────────────────┘  │
│                        │                                 │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │  attack_paths.py │ misconfig_detector.py │ risk.py │  │
│  └─────────────────────┬──────────────────────────────┘  │
│                        │                                 │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │  remediation.py │ mitre_mapping.py │ report_gen.py │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            │ LDAPS (636)
                ┌───────────▼───────────┐
                │   Domain Controller   │
                │   Active Directory    │
                └───────────────────────┘
```

---

## ⚠️ Important Notes

- **This tool does NOT perform:** LLMNR poisoning, SMB relay, NTLM relay, or hash cracking
- **Starting assumption:** Valid domain credentials are already available
- **LDAPS certificate:** The tool accepts self-signed certificates in lab environments
- **Scope:** Designed for small-to-medium AD environments (up to ~500 objects)
- **Platform:** Designed to run on Windows; tested with Python 3.11

---

## 📋 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **AD Communication** | ldap3 (LDAPS / NTLM) |
| **Graph Engine** | NetworkX |
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS |
| **Visualization** | Cytoscape.js |
| **Data Models** | Pydantic v2 |
| **Database** | SQLite (scan history only) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <b>🐾 LURKHOUND</b> — Sniff out every attack path in your Active Directory.
</p>
