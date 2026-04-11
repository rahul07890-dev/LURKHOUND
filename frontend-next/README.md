# AD Attack-Path Discovery Mapper — Next.js Frontend

Modern B2B SaaS-style frontend for the AD Attack-Path Discovery Mapper.
Built with Next.js 14, Tailwind CSS, and Lucide icons.

## Prerequisites

- **Node.js 18+** — [Download from nodejs.org](https://nodejs.org)
- **Python backend running** on port 8000 (`python backend/main.py`)

## Setup

```bash
# 1. Install Node.js from https://nodejs.org (LTS version)

# 2. From the frontend-next directory:
cd "C:\Active Directory Path Discovery Mapper\frontend-next"
npm install

# 3. Start the dev server
npm run dev
```

Then open **http://localhost:3000** in your browser.

## Architecture

```
frontend-next/
  src/
    app/
      page.tsx                    # Login page (/)
      layout.tsx                  # Root layout
      globals.css                 # Tailwind + design system
      dashboard/
        layout.tsx                # Sidebar + auth guard
        overview/page.tsx         # Domain Overview
        objects/page.tsx          # Object Explorer
        graph/page.tsx            # AD Permission Graph
        paths/page.tsx            # Attack Paths viewer
        findings/page.tsx         # Security Findings
    components/
      Sidebar.tsx                 # Left navigation
    context/
      SessionContext.tsx          # In-memory session store
    lib/
      api.ts                      # API client + TypeScript types

next.config.js                    # Proxies /api/* → localhost:8000
```

## How it Works

The Next.js dev server runs on port 3000. All `/api/*` requests are
proxied to the Python FastAPI backend on port 8000 via `next.config.js` rewrites.

The Python backend is unchanged — only CORS origins were updated to
allow `localhost:3000` in addition to `localhost:8000`.

## Build for Production

```bash
npm run build
npm run start
```
