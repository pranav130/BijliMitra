# UPPCL BijliMitra — Modernized Grievance & Anti-Theft Management Platform

Official modernization of the **Uttar Pradesh Power Corporation Limited (UPPCL) BijliMitra** anti-theft grievance redressal system. Replaces the legacy PHP system with a high-performance, strictly parameterized **Node.js (Express 5)** API backend and **React 18** Single Page Application matching the authentic Edmin / Bootstrap theme.

---

## 🚀 Key Improvements Over Legacy System

* **100% Parameterized SQL**: Eliminates 570+ raw unescaped SQL injections present in the legacy PHP system using `mysql2/promise`.
* **Zero PHP Vulnerabilities**: Completely decommissions the PHP engine, immune to PHP2Shell (CVE-2026-109618/19) and future PHP core runtime exploits.
* **Modern Authentication**: Salted BCrypt (Cost Factor 10) password hashing with transparent, automatic legacy MD5 upgrade on login.
* **4-Tier Role-Based Access Control (RBAC)**:
  1. **Tier 1 (Super Admin / HQ)**: Full jurisdiction over 5 DISCOMs, grievance forwarding, and MIS analytics.
  2. **Tier 2 (DISCOM Nodal)**: Scoped view-only monitoring for MVVNL, DVVNL, PVVNL, PuVVNL, and KESCO.
  3. **Tier 3 (Circle / Zone)**: Regional oversight.
  4. **Tier 4 (Field Division)**: 395 field divisions across Uttar Pradesh with assessment recording and reversion workflows.
* **Audit Trail**: Tamper-evident ledger capturing all state mutations with timestamps, officer identities, and IP addresses.
* **Streaming Excel Reports**: High-speed binary spreadsheet generation (`.xlsx`) via SheetJS.

---

## 🛠️ Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   React 18 SPA Client                  │
│       (Authentic Edmin Theme / Bootstrap 2.3.2)        │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON REST (JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Node.js & Express 5 API                  │
│       • Strict Parameterized Queries                   │
│       • 4-Tier RBAC Middleware                         │
│       • BCrypt Password Upgrade Engine                 │
│       • Append-only Audit Trail                        │
└───────────────────────────┬────────────────────────────┘
                            │ Connection Pool (utf8mb4)
                            ▼
┌────────────────────────────────────────────────────────┐
│                     MySQL / MariaDB                    │
│   (admin, tblcomplaints, complaintremark, state, etc.) │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start (Run Locally in 1 Minute)

### Option 1: Using Docker Compose (Easiest - Runs App + MySQL)

```bash
# 1. Clone repository
git clone https://github.com/pranav130/BijliMitra.git
cd BijliMitra

# 2. Launch with Docker Compose
docker compose up -d

# 3. Open browser at:
# http://localhost:5050/
```

---

### Option 2: Using Node.js & Local MySQL

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Update DB_USER, DB_PASSWORD in .env if needed

# 3. Import schema
mysql -u root -p cms_dev < migrations/001_init_cms_dev_schema.sql
# (Optional) Seed mock data:
mysql -u root -p cms_dev < seeds/seed_cms_dev.sql

# 4. Start the application
npm start

# 5. Open browser at:
# http://localhost:5050/
```

---

## 👥 Pre-Configured Test Accounts

| Role Tier | Username | Default Password | Jurisdiction / Scope |
|---|---|---|---|
| **Tier 1 (Super Admin)** | `admin` | `Admin@123` | All 5 DISCOMs (HQ Enforcement Wing) |
| **Tier 2 (DISCOM Nodal)** | `mvvnl_nodal` | `Officer@123` | Madhyanchal Vidyut Vitran Nigam Ltd |
| **Tier 2 (DISCOM Nodal)** | `dvvnl_nodal` | `Officer@123` | Dakshinanchal Vidyut Vitran Nigam Ltd |
| **Tier 4 (Division Officer)** | `div_lucknow_cessu`| `Officer@123` | Field Division (Assessment & Reversion) |

---

## 🧪 Automated Test Suite

Run the full verification test suite (100% pass):

```bash
npm test
```

---

## 📄 License
ISC License — Uttar Pradesh Power Corporation Limited (UPPCL) Modernization Project.
